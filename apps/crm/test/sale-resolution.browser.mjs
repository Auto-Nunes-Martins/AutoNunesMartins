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
  directory = await mkdtemp(path.join(cache, 'sale-resolution-browser-'));
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
    import {onMount} from 'svelte';
    import CancellationPanel from '$lib/components/sale/CancellationPanel.svelte';
    let mode=$state('chain'), form=$state(null);
    const sale={id:'saleA',cancelledAt:null,cancellationDecision:null,customer:{id:'customerA',name:'Cliente A'},vehicle:{id:'A',brand:'BMW',model:'320',licensePlate:'AA-00-AA'},tradeIn:{id:'tradeA',brand:'Ford',model:'Focus',allowanceValue:'3000',disposition:'STOCK'}};
    const context=$derived({deletionBlockers:mode==='chain'?['A retoma já tem despesas e uma venda posterior. Anule e mantenha a viatura como compra normal.']:[],canDeleteTradeIn:mode==='clean',
      dependencies:mode==='chain'?[{saleId:'saleB',vehicleId:'B',label:'Ford Focus'}]:[],
      followingVehicles:mode==='chain'?[{id:'B',label:'Ford Focus',licensePlate:'BB-00-AA',purchasePrice:'3000',sold:true},{id:'C',label:'Renault Clio',licensePlate:'CC-00-AA',purchasePrice:'2100',sold:false}]:[],
      tradeIn:{id:'B',label:'Ford Focus',licensePlate:'BB-00-AA',status:mode==='chain'?'DELIVERED':'DRAFT',purchasePrice:'3000',acquisitionDate:'2026-10-01',expensesCount:mode==='chain'?1:0,expensesTotal:mode==='chain'?'250':'0',hasLaterSale:mode==='chain'}});
    onMount(()=>{window.resolutionState=()=>({sale,context});window.resolutionResponse=value=>form=value;});
  </script>
  <button onclick={()=>{mode=mode==='chain'?'clean':'chain';form=null;window.resolutionConfirmed=null}}>Trocar cenário de teste</button>
  {#key mode}<CancellationPanel {sale} {context} {form}/>{/key}
  <style>:global(:root){--color-red:#d82027;--color-text:#ededed;--color-text-muted:#999;--color-border:#444;--color-bg-1:#1b1b1b;--color-bg-2:#242424;} :global(body){background:#151515;color:#eee;font-family:Arial;}</style>`,
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
    `export function enhance(form,callback){const submit=async event=>{event.preventDefault();const complete=callback({formElement:form,cancel(){}});const d=Object.fromEntries(new FormData(form));if(form.action.includes('reviewCancellation')){const {sale,context}=window.resolutionState();const review={...context,saleId:sale.id,vehicle:{id:'A',label:'BMW 320',licensePlate:'AA-00-AA'},customer:sale.customer,reviewToken:'isolated-review-token',decision:{reason:d.reason,operation:d.operation,tradeInAction:d.tradeInAction,independentPurchasePrice:d.independentPurchasePrice,independentAcquisitionDate:d.independentAcquisitionDate},tradeIn:{...context.tradeIn,allowanceValue:'3000',nextPurchasePrice:d.independentPurchasePrice,nextAcquisitionDate:d.independentAcquisitionDate},affectedSale:context.dependencies.length?{id:'saleB',beforeProfit:'3961.79',afterProfit:'2742.28',beforeVat:'888.21',afterVat:'607.72'}:null,eliminated:d.operation==='DELETE'?['O registo desta venda',...(d.tradeInAction==='DELETE'?['A ficha Ford Focus, criada por engano']:[])]:[],preserved:['A ficha e as despesas da viatura original','As vendas e os valores de entrada das viaturas seguintes'],effects:[]};await complete({result:{type:'success'},update:async()=>window.resolutionResponse({review})});}else{window.resolutionConfirmed=d;await complete({result:{type:'redirect'},update:async()=>{}});}};form.addEventListener('submit',submit);return{destroy(){form.removeEventListener('submit',submit);}};}`,
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
          `<html><head><meta charset="utf-8"></head><body><div id="app">${module.html()}</div><script type="module" src="/client.js"></script></body></html>`,
        );
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
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
    path.basename(directory).startsWith('sale-resolution-browser-')
  )
    await rm(directory, { recursive: true, force: true });
});
for (const width of [390, 1366])
  test('sale resolution with preserved chain at ' + width + 'px', { timeout: 60000 }, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      page.setDefaultTimeout(10000);
      await page.route('**/*', (r) =>
        new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
      );
      await page.goto(origin);
      await page.waitForFunction(() => window.reviewReady && window.resolutionState);
      assert.equal(
        await page.locator('[name="resolutionOperation"][value="DELETE"]').isDisabled(),
        true,
      );
      assert.equal(
        await page
          .locator('[name="tradeInAction"] option[value="RETURN"]')
          .evaluate((e) => e.disabled),
        true,
      );
      assert.match(await page.locator('.chain').innerText(), /Renault Clio/);
      assert.match(await page.locator('.chain').innerText(), /2[.\s]?100/);
      await page.locator('[name="tradeInAction"]').selectOption('KEEP');
      await page.locator('[name="independentPurchasePrice"]').fill('4500');
      await page.locator('[name="reason"]').fill('Negócio desfeito. Compra da viatura confirmada.');
      assert.equal(await page.locator('[name*="Price"]').count(), 1);
      await page
        .getByRole('button', { name: 'Rever efeitos antes de confirmar', exact: true })
        .click();
      await page.getByRole('heading', { name: 'Confirme o que vai acontecer' }).waitFor();
      assert.match(
        await page.locator('.notice').innerText(),
        /valores de entrada das retomas seguintes não mudam/,
      );
      assert.equal(await page.locator('[name="deletionConfirmation"]').count(), 0);
      await page.locator('[name="confirmed"]').check();
      await page.getByRole('button', { name: 'Confirmar anulação', exact: true }).click();
      assert.equal(
        await page.evaluate(() => window.resolutionConfirmed.independentPurchasePrice),
        '4500',
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.getByRole('button', { name: 'Trocar cenário de teste' }).click();
      await page.locator('[name="resolutionOperation"][value="DELETE"]').check();
      await page.locator('[name="tradeInAction"]').selectOption('DELETE');
      await page.locator('[name="reason"]').fill('Registos criados por engano, sem movimentos.');
      await page
        .getByRole('button', { name: 'Rever efeitos antes de confirmar', exact: true })
        .click();
      await page.getByRole('heading', { name: 'Será eliminado', exact: true }).waitFor();
      assert.match(await page.locator('.removed').innerText(), /Ford Focus/);
      await page.locator('[name="confirmed"]').check();
      await page.getByRole('button', { name: 'Eliminar registo errado', exact: true }).click();
      assert.equal(await page.evaluate(() => window.resolutionConfirmed), null);
      await page.locator('[name="deletionConfirmation"]').fill('ELIMINAR');
      await page.getByRole('button', { name: 'Eliminar registo errado', exact: true }).click();
      assert.equal(await page.evaluate(() => window.resolutionConfirmed.tradeInAction), 'DELETE');
      assert.equal(
        await page.evaluate(() => window.resolutionConfirmed.deletionConfirmation),
        'ELIMINAR',
      );
    } finally {
      await page.close();
    }
  });
