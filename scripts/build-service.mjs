import { origin } from '../deployment/routing.mjs';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.CRM_BASE_PATH ?? '/crm';
if (base !== '' && !/^\/[a-zA-Z0-9_-]+$/.test(base)) throw new Error('Invalid CRM_BASE_PATH');
const env = {
  ...process.env,
  CRM_BASE_PATH: base,
  PUBLIC_BACKEND_URL: '',
  PUBLIC_WEBSITE_URL:
    process.env.PUBLIC_WEBSITE_URL ||
    process.env.WEBSITE_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    '',
  HUSKY: '0',
};
origin(env.PUBLIC_WEBSITE_URL, 'PUBLIC_WEBSITE_URL');
for (const args of [
  ['workspace', '@anm/types', 'build:runtime'],
  ['workspace', '@anm/backend', 'prisma:generate'],
  ['workspace', '@anm/backend', 'build'],
  ['workspace', '@anm/website', 'build'],
  ['workspace', '@anm/crm', 'build'],
]) {
  const result = spawnSync(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
mkdirSync('deployment', { recursive: true });
writeFileSync(
  'deployment/build.json',
  JSON.stringify({ crmBasePath: base, websiteOrigin: env.PUBLIC_WEBSITE_URL }) + '\n',
);
