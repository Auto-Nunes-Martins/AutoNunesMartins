// Real entry page with a delayed/rejected navigation; no credentials or business writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';

const workspace = resolve('.');
const root = resolve('.cache/auth-entry-review');
await mkdir(root, { recursive: true });
await writeFile(
  root + '/Entry.svelte',
  `<script>import Entry from '../../apps/crm/src/routes/a-entrar/+page.svelte';</script><Entry />`,
);
await writeFile(
  root + '/client.js',
  `import '../../apps/crm/src/app.css';import {hydrate} from 'svelte';import Entry from './Entry.svelte';hydrate(Entry,{target:document.getElementById('app')});`,
);
await writeFile(
  root + '/environment.js',
  `export const browser=typeof window!=='undefined';export const dev=true;`,
);
await writeFile(root + '/paths.js', `export const base='/crm';`);
await writeFile(
  root + '/navigation.js',
  `export function goto(path,options){window.__entryCalls=(window.__entryCalls??[]).concat({path,options});return new Promise((resolve,reject)=>{window.__entryResolve=resolve;window.__entryReject=()=>reject(new Error('Simulated network failure'))});}`,
);
const server = await createServer({
  root,
  configFile: false,
  plugins: [
    svelte(),
    tailwindcss(),
    {
      name: 'auth-entry-fixture',
      configureServer(vite) {
        vite.middlewares.use(serveEntry);
      },
    },
  ],
  resolve: {
    alias: {
      $lib: resolve('apps/crm/src/lib'),
      '$app/paths': root + '/paths.js',
      '$app/navigation': root + '/navigation.js',
      '$app/environment': root + '/environment.js',
    },
  },
  server: { host: '127.0.0.1', port: 5196, strictPort: true, fs: { allow: [workspace] } },
});
async function serveEntry(req, res, next) {
  if (req.url !== '/') return next();
  try {
    const { default: Entry } = await server.ssrLoadModule('/Entry.svelte');
    const { render } = await server.ssrLoadModule('svelte/server');
    const html = render(Entry);
    res.setHeader('content-type', 'text/html');
    res.end(
      await server.transformIndexHtml(
        '/',
        `<!doctype html><html lang="pt-PT" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1">${html.head}</head><body><div id="app">${html.body}</div><script type="module" src="/client.js"></script></body></html>`,
      ),
    );
  } catch (error) {
    console.error(error);
    next(error);
  }
}
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    const response = await page.goto('http://127.0.0.1:5196/');
    assert(
      (await response.text()).includes('A preparar o seu painel.'),
      'Entry status must be present in SSR HTML',
    );
    await page.waitForFunction(() => window.__entryCalls?.length === 1);
    await page.waitForTimeout(800);
    assert(await page.getByRole('heading', { name: 'A preparar o seu painel.' }).isVisible());
    assert.deepEqual(await page.evaluate(() => window.__entryCalls[0]), {
      path: '/crm/dashboard',
      options: { replaceState: true },
    });
    await page.evaluate(() => window.__entryReject());
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    assert.equal(await page.evaluate(() => window.__entryCalls.length), 2);
    assert(await page.getByRole('heading', { name: 'A preparar o seu painel.' }).isVisible());
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
      assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
      await page.screenshot({ path: root + `/entry-${theme}-${width}.png` });
    }
    console.log(`PASS ${width}: SSR status, slow navigation, base path, replaceState and retry`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await server.close();
}
