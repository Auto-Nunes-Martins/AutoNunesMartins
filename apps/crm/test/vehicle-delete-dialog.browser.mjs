// Isolated components and simulated actions only. No real application, DB or Storage.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer as httpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
let directory, vite, server, browser, origin;
const item = {
  id: 'c111111111111111111111111',
  brand: 'BMW',
  model: 'Série 3',
  year: 2020,
  fuel: 'DIESEL',
  mileage: 10000,
  vin: null,
  licensePlate: 'AA-00-AA',
  purchasePrice: '10000',
  salePrice: '15000',
  status: 'AVAILABLE',
  acquisitionDate: '2026-10-31',
  soldDate: null,
  photos: [],
  pendingDocFlags: {},
  thumbnailUrl: null,
  createdAt: '2026-10-31',
  updatedAt: '2026-10-31',
  sale: null,
};
before(async () => {
  await mkdir(path.join(root, '.svelte-kit'), { recursive: true });
  directory = await mkdtemp(path.join(root, '.svelte-kit/delete-dialog-'));
  const write = (name, text) => writeFile(path.join(directory, name), text);
  await write('package.json', '{"type":"module"}');
  await write(
    'App.svelte',
    `<script>import {onMount} from 'svelte';import Table from '$review/VehicleTable.svelte';import Panel from '$review/VehicleDeletePanel.svelte';let {mode='list'}=$props();let items=$state(${JSON.stringify([item, { ...item, id: 'c222222222222222222222222', model: 'Com venda', status: 'SOLD', sale: { id: 'sale' } }])});onMount(()=>{const remove=e=>items=items.filter(v=>v.id!==e.detail);window.addEventListener('fixture-deleted',remove);return()=>window.removeEventListener('fixture-deleted',remove);});</script><main>{#if mode==='panel'}<form id="edit"><input required name="model"/></form><Panel id="${item.id}" brand="BMW" model="Série 3"/>{:else}<Table {items}/>{/if}</main><style>:global(:root){--color-bg-0:#fff;--color-bg-1:#fff;--color-bg-elevated:#fff;--color-text:#171719;--color-text-muted:#666;--color-border:#ddd;--color-border-strong:#bbb;--color-red:#c91020;--color-danger:#c91020;--radius-card:8px;--radius-btn:4px;}main{padding:20px}:global(.hidden){display:none}@media(min-width:768px){:global(.md\\:hidden){display:none}:global(.md\\:block){display:block}}</style>`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export const html=mode=>render(App,{props:{mode}}).body;`,
  );
  await write(
    'client.js',
    `import {hydrate} from 'svelte';import App from './App.svelte';window.fixturePosts=[];window.nativeDialogs=0;window.confirm=window.alert=()=>{window.nativeDialogs++;throw Error('Native dialog forbidden');};hydrate(App,{target:document.querySelector('#app'),props:{mode:new URL(location.href).searchParams.get('mode')||'list'}});`,
  );
  await write('navigation.js', 'export const goto=async()=>{};');
  await write('paths.js', "export const base='';");
  await write('public.js', "export const PUBLIC_WEBSITE_URL='https://website.invalid';");
  await write('toast.js', 'export const toast={success(){},error(){}};');
  await write(
    'enhance.js',
    `export function enhance(form,submit){const listener=async e=>{e.preventDefault();let canceled=false;const callback=await submit({cancel(){canceled=true;},formElement:form});if(canceled)return;window.fixturePosts.push(form.action);await new Promise(r=>setTimeout(r,100));const fail=!!window.fixtureFailure;await callback({result:fail?{type:'failure',status:409,data:{error:'Eliminação indisponível.'}}:{type:'redirect',status:303,location:'/viaturas'},update:async()=>{if(!fail)window.dispatchEvent(new CustomEvent('fixture-deleted',{detail:new URL(form.action).pathname.split('/')[2]}));}});};form.addEventListener('submit',listener);return{destroy(){form.removeEventListener('submit',listener);}};}`,
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
        { find: '$env/static/public', replacement: path.join(directory, 'public.js') },
        { find: 'svelte-sonner', replacement: path.join(directory, 'toast.js') },
        { find: '$lib', replacement: path.join(root, 'src/lib') },
      ],
    },
    ssr: { noExternal: ['lucide-svelte'] },
    server: { middlewareMode: true, fs: { allow: [path.resolve(root, '../..')] } },
    optimizeDeps: { entries: ['client.js'] },
    logLevel: 'error',
  });
  server = httpServer(async (req, res) => {
    if (req.url?.startsWith('/?') || req.url === '/')
      try {
        const mode = new URL(req.url, 'http://fixture').searchParams.get('mode') || 'list';
        const ssr = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html><body><div id="app">${ssr.html(mode)}</div><script type="module" src="/client.js"></script></body></html>`,
        );
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(html);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
    else vite.middlewares(req, res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
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
  if (server) await new Promise((r) => server.close(r));
});
for (const width of [390, 1366])
  test(
    `list and panel use confirmed custom deletion at ${width}px`,
    { timeout: 60000 },
    async () => {
      const context = await browser.newContext({ viewport: { width, height: 1000 } }),
        page = await context.newPage();
      try {
        await page.goto(origin);
        const opener = page.getByRole('button', {
          name: 'Mais opções de BMW Série 3 · AA-00-AA',
          exact: true,
        });
        const logo = page.locator('.vehicle-name:visible img').first();
        assert.equal(await logo.getAttribute('width'), '16');
        assert.equal(await logo.evaluate((n) => getComputedStyle(n.parentElement).gap), '9px');
        await opener.click();
        const menu = page.getByRole('menu', {
          name: 'Ações de BMW Série 3 · AA-00-AA',
          exact: true,
        });
        await menu.getByRole('menuitem', { name: 'Eliminar viatura', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Eliminar BMW Série 3?', exact: true });
        await dialog.waitFor();
        assert.equal(await page.evaluate(() => window.fixturePosts.length), 0);
        await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.fixturePosts.length), 0);
        await opener.click();
        await page.waitForFunction(
          () =>
            document.querySelector('[role="menu"]:popover-open [role="menuitem"]') ===
            document.activeElement,
        );
        await page.keyboard.press('End');
        assert.equal(
          await menu
            .getByRole('menuitem', { name: 'Eliminar viatura', exact: true })
            .evaluate((n) => document.activeElement === n),
          true,
        );
        await page.keyboard.press('Enter');
        await dialog.waitFor();
        await dialog
          .getByRole('button', { name: 'Eliminar viatura', exact: true })
          .evaluate((n) => {
            n.click();
            n.click();
          });
        await page.waitForFunction(() => window.fixturePosts.length === 1);
        await dialog.waitFor({ state: 'hidden' });
        assert.match(
          (await page.evaluate(() => window.fixturePosts))[0],
          new RegExp('/viaturas/' + item.id + '/editar\\?/delete$'),
        );
        assert.equal(await page.evaluate(() => window.nativeDialogs), 0);
        await page.goto(origin + '/?mode=panel');
        await page.getByRole('button', { name: 'Eliminar viatura', exact: true }).click();
        await dialog.waitFor();
        assert.equal(await page.locator('#edit').evaluate((n) => n.checkValidity()), false);
        await dialog.getByRole('button', { name: 'Eliminar viatura', exact: true }).click();
        await page.waitForFunction(() => window.fixturePosts.length === 1);
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.nativeDialogs), 0);
      } finally {
        await context.close();
      }
    },
  );
test(
  'failed deletion remains cancellable and associated sales cannot open deletion',
  { timeout: 60000 },
  async () => {
    const context = await browser.newContext(),
      page = await context.newPage();
    try {
      await page.goto(origin);
      await page
        .getByRole('button', { name: 'Mais opções de BMW Com venda · AA-00-AA', exact: true })
        .click();
      const soldMenu = page.getByRole('menu', {
        name: 'Ações de BMW Com venda · AA-00-AA',
        exact: true,
      });
      assert.equal(
        await soldMenu
          .getByRole('menuitem', { name: 'Eliminar viatura', exact: true })
          .isDisabled(),
        true,
      );
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', { name: 'Mais opções de BMW Série 3 · AA-00-AA', exact: true })
        .click();
      await page
        .getByRole('menu', { name: 'Ações de BMW Série 3 · AA-00-AA', exact: true })
        .getByRole('menuitem', { name: 'Eliminar viatura', exact: true })
        .click();
      await page.evaluate(() => (window.fixtureFailure = true));
      const dialog = page.getByRole('dialog', { name: 'Eliminar BMW Série 3?', exact: true });
      await dialog.getByRole('button', { name: 'Eliminar viatura', exact: true }).click();
      await page.waitForFunction(() => window.fixturePosts.length === 1);
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.nativeDialogs), 0);
    } finally {
      await context.close();
    }
  },
);
