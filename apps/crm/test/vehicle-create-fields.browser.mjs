// Isolated UI only: no application server, credentials, database, Storage or form submission.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
let directory, vite, server, browser, origin;
before(async () => {
  await mkdir(path.join(root, '.svelte-kit'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.svelte-kit/create-fields-'));
  const write = (name, text) => writeFile(path.join(directory, name), text);
  await write('package.json', '{"type":"module"}');
  await write(
    'App.svelte',
    `<script>import Form from '$review/NewVehicleDraftForm.svelte';import '$lib/styles/formLayout.css';</script><main><Form draftOwner="fixture"/></main><style>:global(:root){--color-bg-0:#fff;--color-bg-elevated:#fff;--color-bg-2:#eee;--color-text:#171719;--color-text-muted:#555;--color-border:#bbb;--color-red:#bf1725;--radius-btn:6px;}main{max-width:1100px;margin:auto;padding:24px;}</style>`,
  );
  await write(
    'client.js',
    `import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app')});`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export const html=()=>render(App).body;`,
  );
  await write('navigation.js', 'export const goto=async()=>{};');
  await write('paths.js', "export const base='';");
  await write('toast.js', 'export const toast={success(){},error(){}};');
  await write(
    'enhance.js',
    `export function enhance(form){const listener=e=>e.preventDefault();form.addEventListener('submit',listener);return{destroy(){form.removeEventListener('submit',listener);}};}`,
  );
  vite = await createServer({
    configFile: false,
    root: directory,
    plugins: [svelte({ configFile: false })],
    resolve: {
      alias: [
        { find: '$review', replacement: path.join(root, 'src/lib/components/vehicle') },
        { find: '$lib/auth/enhance', replacement: path.join(directory, 'enhance.js') },
        { find: '$app/navigation', replacement: path.join(directory, 'navigation.js') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
        { find: 'svelte-sonner', replacement: path.join(directory, 'toast.js') },
        { find: '$lib', replacement: path.join(root, 'src/lib') },
      ],
    },
    ssr: { noExternal: ['lucide-svelte'] },
    server: { middlewareMode: true, fs: { allow: [path.resolve(root, '../..')] } },
    optimizeDeps: { entries: ['client.js'] },
    logLevel: 'error',
  });
  server = createHttpServer(async (req, res) => {
    if (req.url === '/')
      try {
        const ssr = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html><head></head><body><div id="app">${ssr.html()}</div><script type="module" src="/client.js"></script></body></html>`,
        );
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(html);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    else vite.middlewares(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL }
      : {}),
  });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  // Preserve the generated isolated fixtures; never perform automatic recursive cleanup.
});
for (const width of [390, 1366])
  test(
    `new first step includes and recovers all characteristics at ${width}px`,
    { timeout: 60000 },
    async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } }),
        page = await context.newPage();
      try {
        await page.goto(origin);
        await page.getByRole('group', { name: 'Características e equipamento' }).waitFor();
        await page.locator('[name="publicTransmission"]').selectOption('MANUAL');
        const values = {
          version: '1.0 TCe',
          category: 'Familiar',
          color: 'Azul',
          powerHp: '110',
          engineCc: '999',
          doors: '5',
          seats: '7',
          equipment: 'Ar condicionado\nSensores de estacionamento',
        };
        for (const [name, value] of Object.entries(values))
          await page.locator(`[name="${name}"]`).fill(value);
        await page.getByText('Rascunho guardado neste dispositivo', { exact: true }).waitFor();
        const capture = () =>
          page.evaluate(() =>
            Object.fromEntries(new FormData(document.querySelector('form[data-edit-vehicle]'))),
          );
        const first = await capture();
        for (const [name, value] of Object.entries(values)) assert.equal(first[name], value);
        assert.equal(first.publicTransmission, 'MANUAL');
        assert.equal(first.specificationsPresent, 'true');
        await page.reload();
        await page.getByText('Rascunho recuperado neste dispositivo', { exact: true }).waitFor();
        const restored = await capture();
        for (const [name, value] of Object.entries(values)) assert.equal(restored[name], value);
        assert.equal(restored.publicTransmission, 'MANUAL');
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await page.screenshot({
          path: path.join(directory, `first-step-${width}.png`),
          fullPage: true,
        });
      } finally {
        await context.close();
      }
    },
  );
