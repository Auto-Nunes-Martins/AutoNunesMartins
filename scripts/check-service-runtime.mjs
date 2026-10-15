import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:10000';
const manifest = JSON.parse(fs.readFileSync('deployment/build.json', 'utf8'));
assert.equal(manifest.crmBasePath, '/crm', 'Build CRM_BASE_PATH=/crm before this smoke test');
assert.equal(
  manifest.websiteOrigin,
  base,
  'Build PUBLIC_WEBSITE_URL=http://127.0.0.1:10000 before this smoke test',
);
const probe = http.createServer();
await new Promise((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(10000, '127.0.0.1', () => probe.close(resolve));
});
const env = {
  SystemRoot: process.env.SystemRoot,
  PATH: process.env.PATH,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  DOTENV_CONFIG_PATH: '.cache/nonexistent-smoke.env',
  WEBSITE_ORIGIN: base,
  CRM_ORIGIN: base,
  CRM_BASE_PATH: '/crm',
  PORT: '10000',
  SITE_NOINDEX: 'true',
  ADMIN_CLERK_USER_IDS: 'user_fixture',
  DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:9/fixture?connect_timeout=1',
  DIRECT_URL: 'postgresql://fixture:fixture@127.0.0.1:9/fixture',
  SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SECRET_KEY: 'fixture-only-not-a-real-key',
  PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Zml4dHVyZS5jbGVyay5hY2NvdW50cy5kZXYk',
  CLERK_PUBLISHABLE_KEY: 'pk_test_Zml4dHVyZS5jbGVyay5hY2NvdW50cy5kZXYk',
  CLERK_SECRET_KEY: 'sk_test_fixture',
  CLERK_WEBHOOK_SECRET: 'whsec_fixture',
  CONTACT_ENABLED: 'false',
  CONTACT_PRIVACY_READY: 'false',
  LOG_LEVEL: 'fatal',
};
const output = fs.openSync('.cache/combined-runtime.log', 'w');
const child = spawn(process.execPath, ['deployment/start.mjs'], {
  env,
  stdio: ['ignore', output, output, 'ipc'],
});
const call = (path, options = {}) =>
  fetch(base + path, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15000) });
try {
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error('launcher exited; inspect runtime log');
    try {
      const r = await call('/healthz');
      if (r.status === 200) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert(healthy, 'service healthy');
  for (const path of [
    '/healthz',
    '/quem-somos',
    '/crm',
    '/crm/',
    '/crm/dashboard',
    '/crm/api/users',
    '/api/users',
    '/crm/logo-transparent.png',
    '/robots.txt',
    '/sitemap.xml',
  ]) {
    const r = await call(path);
    const text = path.endsWith('.png') ? '' : await r.text();
    console.log(
      JSON.stringify({
        path,
        status: r.status,
        robots: r.headers.get('x-robots-tag'),
        cache: r.headers.get('cache-control'),
        location: r.headers.get('location'),
        mime: r.headers.get('content-type'),
      }),
    );
    if (path === '/quem-somos') {
      assert.equal(r.status, 200);
      assert(text.includes('http://127.0.0.1:10000/quem-somos'));
      assert(!text.includes('clerk.accounts'));
    }
    if (path === '/crm') {
      assert.equal(r.status, 308);
      assert.equal(r.headers.get('location'), '/crm/');
    }
    if (path === '/crm/') {
      assert.equal(r.status, 200);
      fs.writeFileSync('.cache/crm-login.html', text);
      assert(text.includes('_app/'));
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
    }
    if (path === '/crm/dashboard' || path === '/crm/api/users') {
      assert.equal(r.status, 303);
      assert.equal(r.headers.get('location'), '/crm/');
    }
    if (path === '/api/users') assert.equal(r.status, 401);
    if (path === '/crm/logo-transparent.png') assert.equal(r.status, 200);
    if (path === '/sitemap.xml') assert.equal(r.status, 503); // unavailable fixture DB must not produce a partial sitemap
  }
  const login = await (await call('/crm/')).text();
  const asset = login.match(/(?:href|src)="([^"]*_app\/[^" ]+\.(?:js|css))"/);
  if (asset) assert.equal((await call(new URL(asset[1], base + '/crm/').pathname)).status, 200);
  assert.equal(
    (
      await call('/crm/api/tasks', {
        method: 'POST',
        headers: { origin: 'https://evil.test', 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
    403,
  );
  const check = spawn(process.execPath, ['deployment/healthcheck.mjs'], { env, stdio: 'inherit' });
  const healthExit = await new Promise((resolve) => check.once('exit', resolve));
  assert.equal(healthExit, 0, 'Docker healthcheck command uses the configured host');
  console.log('Combined runtime assertions passed');
} finally {
  child.send('shutdown');
  let deadline;
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => {
      deadline = setTimeout(resolve, 22000);
    }),
  ]);
  clearTimeout(deadline);
  if (child.exitCode === null) child.kill('SIGKILL');
  fs.closeSync(output);
}
