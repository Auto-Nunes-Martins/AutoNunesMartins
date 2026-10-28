import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium } from '@playwright/test';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
let directory, vite, server, browser, origin;

before(async () => {
  const cache = path.join(appRoot, '.svelte-kit');
  await mkdir(cache, { recursive: true });
  directory = await mkdtemp(path.join(cache, 'trade-in-browser-'));
  const write = (name, value) => writeFile(path.join(directory, name), value);
  await write('package.json', '{"type":"module"}');
  await write('Icon.svelte', '<svg></svg>');
  await write(
    'icons.js',
    "export {default as ArrowRightLeft, default as Calendar, default as Search, default as Tag, default as User, default as CalendarDays, default as ChevronLeft, default as ChevronRight} from './Icon.svelte';",
  );
  await write(
    'App.svelte',
    `<script>
    import SalePage from '$sale/+page.svelte';
    const data={vehicle:{id:'original',brand:'BMW',model:'320',year:2020,licensePlate:'AA-00-AA',purchasePrice:'10000',salePrice:'15000',expensesTotal:'100'},
      customers:[{id:'customer',name:'Cliente teste',nif:'123456789',phone:'900000000',_count:{sales:0}}]};
  </script><SalePage {data}/>
  <style>:global(:root){--color-red:#d82027;--color-red-soft:#b01017;} :global(.bg-\\[var\\(--color-red\\)\\]){background:var(--color-red);}</style>`,
  );
  await write(
    'client.js',
    `import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app')});window.reviewReady=true;`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export function html(){return render(App).body;}`,
  );
  await write('navigation.js', 'export const goto=async()=>{};');
  await write(
    'session.js',
    'export const sessionFetch=async()=>{throw Error("No external requests in test")};',
  );
  await write('paths.js', "export const base='';");
  await write('toast.js', 'export const toast={success(){},error(){}};');
  await write(
    'enhance.js',
    `export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const complete=callback({formElement:form,cancel(){cancelled=true}});if(!cancelled){window.reviewPayload=Object.fromEntries(new FormData(form));if(complete)await complete({result:{type:'failure',data:{error:'Falha simulada, pode corrigir e repetir.'}},update:async()=>{}});}};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`,
  );
  vite = await createServer({
    configFile: false,
    root: directory,
    plugins: [svelte({ configFile: false })],
    resolve: {
      alias: [
        { find: 'lucide-svelte', replacement: path.join(directory, 'icons.js') },
        { find: '$sale', replacement: path.join(appRoot, 'src/routes/(app)/viaturas/[id]/vender') },
        {
          find: /^@anm\/types$/,
          replacement: path.resolve(appRoot, '../../shared/types/src/index.ts'),
        },
        {
          find: /^@anm\/types\/(.+)$/,
          replacement: path.resolve(appRoot, '../../shared/types/src') + '/$1.ts',
        },
        { find: '$lib/auth/session', replacement: path.join(directory, 'session.js') },
        { find: '$lib/auth/enhance', replacement: path.join(directory, 'enhance.js') },
        { find: '$app/navigation', replacement: path.join(directory, 'navigation.js') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
        { find: 'svelte-sonner', replacement: path.join(directory, 'toast.js') },
        { find: '$lib', replacement: path.join(appRoot, 'src/lib') },
      ],
    },
    server: { hmr: false, middlewareMode: true, fs: { allow: [path.resolve(appRoot, '../..')] } },
    optimizeDeps: { entries: ['client.js'] },
    logLevel: 'error',
  });
  server = createHttpServer(async (request, response) => {
    if (request.url === '/') {
      try {
        const module = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html><head></head><body><div id="app">${module.html()}</div><script type="module" src="/client.js"></script></body></html>`,
        );
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      }
    } else vite.middlewares(request, response);
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
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (
    directory &&
    path.dirname(directory) === path.join(appRoot, '.svelte-kit') &&
    path.basename(directory).startsWith('trade-in-browser-')
  )
    await rm(directory, { recursive: true, force: true });
});
for (const width of [390, 1366])
  test('trade-in intake and customer button at ' + width + 'px', { timeout: 60000 }, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      page.setDefaultTimeout(10000);
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      await page.goto(origin);
      await page.waitForFunction(() => window.reviewReady);
      const add = page.getByRole('button', { name: 'Adicionar cliente', exact: true });
      assert.equal(
        await add.evaluate((e) => getComputedStyle(e).backgroundColor),
        'rgb(216, 32, 39)',
      );
      await add.click();
      assert.equal(await page.locator('dialog').evaluate((e) => e.open), true);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Cliente teste/ }).click();
      await page.getByRole('checkbox', { name: /Cliente entrega carro como retoma/ }).check();
      assert.equal(
        await page.locator('[name="tradeIn.licensePlate"]').evaluate((e) => e.required),
        true,
      );
      assert.equal(await page.locator('[name="tradeIn.vin"]').evaluate((e) => e.required), false);
      assert.equal(await page.locator('[name="tradeIn.fuel"]').inputValue(), '');
      for (const [name, value] of Object.entries({
        brand: 'Renault',
        model: 'Clio',
        year: '2018',
        mileage: '120000',
        licensePlate: '12ab34',
        allowanceValue: '0',
        notes: 'Revisão em falta',
      }))
        await page.locator('[name="tradeIn.' + name + '"]').fill(value);
      await page.locator('[name="tradeIn.licensePlate"]').blur();
      assert.equal(await page.locator('[name="tradeIn.licensePlate"]').inputValue(), '12-AB-34');
      await page.locator('[name="tradeIn.fuel"]').selectOption('DIESEL');
      await page.locator('[name="tradeIn.pendingDocFlags.docs"]').check();
      await page.getByRole('button', { name: 'Registar venda', exact: true }).click();
      await page.waitForFunction(() => window.reviewPayload);
      const payload = await page.evaluate(() => window.reviewPayload);
      assert.equal(payload['tradeIn.vin'], '');
      assert.equal(payload['tradeIn.allowanceValue'], '0');
      assert.equal(payload['tradeIn.pendingDocFlags.docs'], 'true');
      assert.equal(await page.locator('[name="tradeIn.notes"]').inputValue(), 'Revisão em falta');
      await page.getByRole('radio', { name: 'Abate / desmanche', exact: true }).click();
      assert.equal(
        await page.locator('[name="tradeIn.licensePlate"]').evaluate((e) => e.required),
        false,
      );
      assert.equal(await page.locator('[name="tradeIn.pendingDocFlags.docs"]').count(), 0);
    } finally {
      await page.close();
    }
  });
