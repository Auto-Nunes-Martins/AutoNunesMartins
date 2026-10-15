import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { config } from './routing.mjs';
import { createGateway } from './gateway.mjs';

const settings = config(process.env);
const manifest = JSON.parse(await readFile(new URL('./build.json', import.meta.url), 'utf8'));
if (manifest.crmBasePath !== settings.base)
  throw new Error('CRM_BASE_PATH differs from build; rebuild required');
if (manifest.websiteOrigin !== settings.website.origin)
  throw new Error('WEBSITE_ORIGIN differs from PUBLIC_WEBSITE_URL build; rebuild required');
const ports = { backend: 4100, website: 4101, crm: 4102 };
let ready = false;
let stopping = false;
const children = [];
const gateway = createGateway(settings, ports, () => ready && !stopping);
const common = {
  ...process.env,
  NODE_ENV: 'production',
  INTERNAL_BACKEND_URL: 'http://127.0.0.1:4100',
};
const websiteEnv = Object.fromEntries(
  Object.entries(common).filter(
    ([key]) =>
      !key.includes('CLERK') &&
      !key.startsWith('DATABASE') &&
      !key.startsWith('DIRECT_') &&
      !key.startsWith('SUPABASE'),
  ),
);
const launch = (service, file, extra) => {
  const child = spawn(process.execPath, ['--conditions=anm-runtime', file], {
    stdio: 'inherit',
    env: { ...(service === 'website' ? websiteEnv : common), ...extra },
  });
  children.push(child);
  child.on('error', () => shutdown(1));
  child.on('exit', () => {
    if (!stopping) shutdown(1);
  });
};
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  ready = false;
  gateway.close();
  gateway.closeIdleConnections();
  for (const child of children) child.kill('SIGTERM');
  const deadline = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(1);
  }, 18000);
  Promise.all(
    children.map((child) =>
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once('exit', resolve)),
    ),
  ).then(() => {
    clearTimeout(deadline);
    process.exit(code);
  });
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());
// An IPC parent can request the same shutdown path in local Windows smoke tests.
if (process.channel)
  process.on('message', (message) => {
    if (message === 'shutdown') shutdown();
  });
launch('backend', 'backend/dist/index.js', {
  PORT: String(ports.backend),
  BACKEND_HOST: '127.0.0.1',
  FRONTEND_ORIGIN: settings.crm.origin,
});
launch('website', 'apps/website/build/index.js', {
  PORT: String(ports.website),
  HOST: '127.0.0.1',
  ORIGIN: settings.website.origin,
  SITE_NOINDEX: String(settings.noindex),
  BODY_SIZE_LIMIT: '16384',
});
launch('crm', 'apps/crm/build/index.js', {
  PORT: String(ports.crm),
  HOST: '127.0.0.1',
  ORIGIN: settings.crm.origin,
  PUBLIC_CLERK_SIGN_IN_URL: settings.base + '/',
  BODY_SIZE_LIMIT: '20971520',
});
gateway.on('error', () => shutdown(1));
gateway.listen(Number(process.env.PORT || 10000), '0.0.0.0');
// Probe each internal listener without touching the database or sending email.
for (let attempt = 0; attempt < 120 && !stopping; attempt++) {
  const checks = await Promise.all(
    Object.entries(ports).map(async ([service, port]) => {
      try {
        const response = await fetch(
          `http://127.0.0.1:${port}${service === 'backend' ? '/health' : service === 'crm' ? settings.base + '/logo-transparent.png' : '/logo-transparent.png'}`,
          { signal: AbortSignal.timeout(500), redirect: 'manual' },
        );
        await response.body?.cancel();
        return response.status === 200;
      } catch {
        return false;
      }
    }),
  );
  if (checks.every(Boolean)) {
    ready = true;
    console.info('Combined service ready');
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!ready && !stopping) shutdown(1);
