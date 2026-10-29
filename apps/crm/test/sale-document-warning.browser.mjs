// Actual edit page and components; requests and saved vehicles are isolated fixtures.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath } from 'node:fs/promises';
import { createServer as httpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const id = 'c000000000000000000000001';
const photo = `${id}/00000000-0000-4000-8000-000000000002.webp`;
const image =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="gray"/></svg>',
  );
function fixture(query = '') {
  const empty = query.includes('empty'),
    blocked = query.includes('blocked');
  return {
    customers: [
      {
        id: 'customer-1',
        name: 'Cliente teste',
        nif: '123456789',
        phone: '910000000',
        _count: { sales: 0 },
      },
    ],
    vehicle: {
      id,
      brand: 'BMW',
      model: 'One',
      year: 2020,
      fuel: 'DIESEL',
      mileage: 10000,
      vin: 'WBA12345678912345',
      licensePlate: 'AA-00-AA',
      purchasePrice: '10000',
      salePrice: '19000',
      status: blocked ? 'DOCS_PENDING' : 'AVAILABLE',
      acquisitionDate: '2026-01-01',
      description: 'Notas internas',
      pendingDocFlags: {
        financing: false,
        imt: false,
        registration: false,
        docs: query.includes('pending'),
      },
      sale: null,
      soldDate: null,
      updatedAt: '2026-10-28T00:00:00.000Z',
      photos: empty ? [] : [photo],
      webPublished: query.includes('detail'),
      publicSlug: query.includes('detail') ? 'vehicle-aaaaaaaaaaaa' : null,
      publicPrice: null,
      publicDescription: 'Descrição pública confirmada.',
      publicTransmission: null,
      publicSpecifications: null,
      expenses: [
        {
          id: 'expense-1',
          category: 'REPAIR',
          description: 'Reparação confirmada',
          amount: '120.00',
          date: '2026-10-20',
        },
      ],
      expensesTotal: '120.00',
      figures: {
        margin: '9000.00',
        vatAmount: '1682.93',
        commission: '0.00',
        realProfit: '7197.07',
      },
    },
    isFeatured: false,
    signedPhotos: empty ? [] : [{ path: photo, url: image }],
  };
}
const fixtureStates = new Map();
let directory, vite, server, browser, origin;
before(async () => {
  await mkdir(path.join(appRoot, '.svelte-kit'), { recursive: true });
  directory = await mkdtemp(path.join(appRoot, '.svelte-kit/sale-document-warning-'));
  const write = (name, value) => writeFile(path.join(directory, name), value);
  await write('package.json', '{"type":"module"}');
  await write('review.css', "@import '../../src/app.css';\n@source '../../src';");
  await write(
    'App.svelte',
    `<script>import {onMount} from 'svelte';import EditPage from '$edit';import DetailPage from '$detail';import HomepageHighlightsEditor from '$lib/components/vehicle/HomepageHighlightsEditor.svelte';import VehicleTable from '$lib/components/vehicle/VehicleTable.svelte';import {Toaster} from 'svelte-sonner';let {data,detail=false,mode=""}=$props();let returned=$state(false);onMount(()=>{const navigate=()=>returned=true;window.addEventListener("fixture-navigate",navigate);return()=>window.removeEventListener("fixture-navigate",navigate);});onMount(()=>{const refresh=()=>{if(window.reviewNextData)data=structuredClone(window.reviewNextData);};window.addEventListener('fixture-invalidate',refresh);return()=>window.removeEventListener('fixture-invalidate',refresh);});</script><main style="max-width:1280px;margin:auto;padding:96px 20px 40px">{#if returned}<h1>Destino confirmado</h1><p>{window.reviewSavedModel}</p>{:else if mode === "highlights"}<HomepageHighlightsEditor editor={data.editor} selectedVehicleId={data.selectedVehicleId}/>{:else if mode === "list"}<VehicleTable items={data.items}/>{:else if detail}<DetailPage {data}/>{:else}<EditPage {data}/>{/if}</main><Toaster/>`,
  );
  await write(
    'client.js',
    `import './review.css';import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app'),props:{data:window.reviewData,detail:window.reviewDetail,mode:window.reviewMode}});window.reviewReady=true;`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export const html=(data,detail,mode)=>render(App,{props:{data,detail,mode}}).body;`,
  );
  await write('paths.js', "export const base='';");
  await write(
    'navigation.js',
    "import {hasUnsavedForms} from '$lib/forms/formFeedback';export const afterNavigate=(callback)=>{if(typeof window!=='undefined')queueMicrotask(()=>callback({from:window.reviewFrom?{url:new URL(window.reviewFrom,location.origin)}:null,to:{url:new URL(location.href)}}));};export const goto=async(href,options)=>{window.reviewNavigation={href,options,dirty:hasUnsavedForms()};if(window.reviewSimulateNavigation){history.pushState({},'',href);window.dispatchEvent(new Event('fixture-navigate'));}};export const invalidateAll=async()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('fixture-invalidate'));};",
  );
  await write('public.js', "export const PUBLIC_WEBSITE_URL='http://website.fixture';");
  await write('session.js', 'export const sessionFetch=(...args)=>fetch(...args);');
  await write(
    'enhance.js',
    `export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const handler=await callback({formElement:form,formData:new FormData(form),cancel(){cancelled=true;}});if(cancelled)return;const response=await fetch(form.action,{method:'POST',body:new FormData(form)});const result=await response.json();await handler?.({result,update:async()=>{window.dispatchEvent(new Event('fixture-invalidate'));}});};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`,
  );
  server = httpServer(async (req, res) => {
    if (req.url.startsWith('/viaturas/')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<h1>Ficha de teste</h1>');
      return;
    }
    if (req.url === '/' || req.url.startsWith('/?') || req.url.startsWith('/site/destaques')) {
      try {
        const mode = req.url.includes('/site/destaques')
            ? 'highlights'
            : req.url.includes('list=1')
              ? 'list'
              : '',
          data = fixtureStates.get(req.headers['x-review-case']) ?? fixture(req.url),
          detail = req.url.includes('detail'),
          module = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>window.reviewData=${JSON.stringify(data)};window.reviewDetail=${detail};window.reviewMode=${JSON.stringify(mode)}</script><div id="app">${module.html(data, detail, mode)}</div><script type="module" src="/client.js"></script></body></html>`,
        );
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(html);
      } catch (e) {
        res.writeHead(500);
        res.end(String(e));
      }
      return;
    }
    vite.middlewares(req, res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + server.address().port;
  vite = await createServer({
    configFile: false,
    root: directory,
    plugins: [tailwindcss(), svelte({ configFile: false })],
    ssr: { noExternal: ['lucide-svelte', 'svelte-sonner'] },
    resolve: {
      alias: [
        {
          find: '$detail',
          replacement: path.join(appRoot, 'src/routes/(app)/viaturas/[id]/+page.svelte'),
        },
        {
          find: '$edit',
          replacement: path.join(appRoot, 'src/routes/(app)/viaturas/[id]/vender/+page.svelte'),
        },
        { find: '$lib/auth/session', replacement: path.join(directory, 'session.js') },
        { find: '$lib/auth/enhance', replacement: path.join(directory, 'enhance.js') },
        { find: '$app/navigation', replacement: path.join(directory, 'navigation.js') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
        { find: '$env/static/public', replacement: path.join(directory, 'public.js') },
        { find: '$lib', replacement: path.join(appRoot, 'src/lib') },
      ],
    },
    server: {
      middlewareMode: true,
      hmr: { server, host: '127.0.0.1', clientPort: Number(new URL(origin).port) },
      fs: {
        allow: [
          path.resolve(appRoot, '../..'),
          await realpath(path.resolve(appRoot, '../../node_modules')),
        ],
      },
    },
    optimizeDeps: { entries: ['client.js'], include: ['heic-to/next'] },
    logLevel: 'error',
  });
  browser = await chromium.launch({
    headless: true,
    channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || 'chrome',
  });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise((r) => server.close(r));
});

for (const scenario of ['normal', 'pending', 'blocked'])
  test(`sale document warning: ${scenario}`, { timeout: 120000 }, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } }),
      page = await context.newPage();
    let posts = 0;
    await page.route('**/?/submit', async (route) => {
      posts++;
      await route.fulfill({
        json: { type: 'failure', status: 422, data: { error: 'Falha de teste: dados mantidos.' } },
      });
    });
    try {
      await page.goto(`${origin}/?${scenario}`);
      await page.waitForFunction(() => window.reviewReady);
      await page.getByRole('button', { name: /Cliente teste/ }).click();
      const submit = page.getByRole('button', { name: 'Registar venda', exact: true });
      await submit.click();
      if (scenario !== 'normal') {
        const dialog = page.getByRole('dialog', { name: 'Vender com documentos em falta?' });
        await dialog.waitFor();
        assert.equal(posts, 0);
        await dialog.getByRole('button', { name: 'Voltar', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        assert.equal(posts, 0);
        assert.equal(await page.locator('[name=salePrice]').inputValue(), '19000');
        await submit.click();
        await dialog.waitFor();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('dialog[open]'));
        assert.equal(posts, 0);
        await submit.click();
        await dialog.waitFor();
        await dialog
          .getByRole('button', { name: 'Continuar venda com documentos em falta', exact: true })
          .click();
      }
      await page.waitForFunction(() =>
        document.querySelector('[data-sonner-toast]')?.textContent?.includes('Falha de teste'),
      );
      assert.equal(posts, 1, 'one POST after continuation, without repeat confirmation');
      assert.equal(
        await page.getByRole('dialog', { name: 'Vender com documentos em falta?' }).isVisible(),
        false,
      );
      assert.equal(await page.locator('[name=salePrice]').inputValue(), '19000');
    } finally {
      await context.close();
    }
  });
