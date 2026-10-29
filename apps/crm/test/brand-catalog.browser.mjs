import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
let directory, vite, server, browser, origin;
const initial = {
  brand: 'Dacia',
  model: 'Jogger',
  licensePlate: 'AA-12-BB',
  year: 2023,
  fuel: 'GASOLINE',
  mileage: 11000,
  vin: 'VF100000000000002',
  purchasePrice: '10000',
  salePrice: '15000',
  status: 'AVAILABLE',
  acquisitionDate: '2026-10-20',
  description: 'Notas iniciais',
  pendingDocFlags: { financing: false, imt: false, registration: false, docs: false },
};

before(async () => {
  const cache = path.join(appRoot, '.svelte-kit');
  await mkdir(cache, { recursive: true });
  directory = await mkdtemp(path.join(cache, 'vehicle-form-browser-'));
  const write = (name, value) => writeFile(path.join(directory, name), value);
  await write('package.json', '{"type":"module"}');
  await write(
    'App.svelte',
    `<script>
    import VehicleForm from '$review/VehicleForm.svelte';
    let initial = $state(${JSON.stringify(initial)});
    let locked = $state(false), payload = $state('');
    function capture() { payload = JSON.stringify(Object.fromEntries(new FormData(document.querySelector('form[data-edit-vehicle]')))); }
  </script>
  <VehicleForm {initial} disabled={locked} unified onsaveall={capture}/>
  <button type="button" onclick={() => document.querySelector('form[data-edit-vehicle]').requestSubmit()}>Guardar teste</button><button type="button" onclick={() => locked = !locked}>Alternar bloqueio</button>
  <button type="button" onclick={() => initial = {...initial, brand: 'Recuperada', model: 'Rascunho', licensePlate: 'EF-56-GH'}}>Recuperar rascunho</button>
  <output id="payload" style="display:none">{payload}</output>`,
  );
  await write('Icon.svelte', '<svg width="16" height="16"></svg>');
  await write(
    'icons.js',
    "export {default as CalendarDays,default as ChevronLeft,default as ChevronRight, default as CarFront, default as Gauge, default as Fuel, default as Car, default as SprayCan} from './Icon.svelte';",
  );
  await write(
    'client.js',
    `import ${JSON.stringify(path.join(appRoot,'src/app.css').split(path.sep).join('/'))};import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app')});window.reviewReady=true;`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export function html(){return render(App).body;}`,
  );
  await write('navigation.js', 'export const goto=async()=>{};');
  await write('paths.js', "export const base='';");
  await write('toast.js', 'export const toast={success(){},error(){}};');
  await write(
    'enhance.js',
    `export function enhance(form,callback){const submit=event=>{event.preventDefault();callback({formElement:form,cancel(){}});};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`,
  );
  vite = await createServer({
    configFile: false,
    root: directory,
    plugins: [tailwindcss(), svelte({ configFile: false })],
    resolve: {
      alias: [
        { find: '$review', replacement: path.join(appRoot, 'src/lib/components/vehicle') },
        { find: '$lib/auth/enhance', replacement: path.join(directory, 'enhance.js') },
        { find: '$app/navigation', replacement: path.join(directory, 'navigation.js') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
        { find: 'lucide-svelte', replacement: path.join(directory, 'icons.js') },
        { find: 'svelte-sonner', replacement: path.join(directory, 'toast.js') },
        { find: '$lib', replacement: path.join(appRoot, 'src/lib') },
      ],
    },
    server: { middlewareMode: true, fs: { allow: [path.resolve(appRoot, '../..')] } },
    optimizeDeps: { entries: ['client.js'] },
    logLevel: 'error',
  });
  server = createHttpServer(async (request, response) => {
    if (request.url === '/') {
      try {
        const module = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html data-theme="dark"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style="padding:24px;background:#0a0a0b;color:#eee;max-width:1100px;margin:auto"><div id="app">${module.html()}</div><script type="module" src="/client.js"></script></body></html>`,
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
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    directory &&
    path.dirname(directory) === path.join(appRoot, '.svelte-kit') &&
    path.basename(directory).startsWith('vehicle-form-browser-')
  )
    await rm(directory, { recursive: true, force: true });
});

for (const width of [390,1366]) test('catalogue selection, keyboard and retained edit at '+width+'px', {timeout:60000}, async()=>{
 const page=await browser.newPage({viewport:{width,height:900}});
 try{await page.goto(origin);await page.waitForFunction(()=>window.reviewReady);
 const combo=page.getByRole('combobox',{name:'Marca',exact:true}); await assert.equal(await combo.inputValue(),'Dacia');
 await combo.click(); await assert.ok(await page.getByRole('option',{name:'Renault',exact:true}).isVisible().catch(()=>false) || await page.locator('.brand-list').getByRole('option').count()>180);
 await combo.fill('CITROEN');await page.waitForFunction(()=>document.querySelectorAll('.brand-list [role=option]').length===1); await combo.press('ArrowDown');await combo.press('Enter');
 await assert.equal(await page.locator('input[type=hidden][name=brand]').inputValue(),'Citroën');
 await page.getByRole('button',{name:'Guardar teste',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('#payload').textContent.includes('Citroën'));
 assert.equal(JSON.parse(await page.locator('#payload').textContent()).brand,'Citroën');
 await combo.click();await combo.fill('Brand invented');assert.equal(await page.locator('input[type=hidden][name=brand]').inputValue(),'');
 assert.ok((await page.locator('.brand-list').textContent()).includes('Nenhuma marca encontrada'));assert.equal(await combo.evaluate(el=>el.validity.valid),false);
 await combo.fill('SKODA'); await page.getByRole('option',{name:'Škoda',exact:true}).click();assert.equal(await combo.inputValue(),'Škoda');
 await combo.click();await combo.fill('RENAULT');await page.getByRole('option',{name:'Renault',exact:true}).click();
 await combo.click();await combo.fill('vol');
 await mkdir(path.join(appRoot,'../../docs/brand-catalog'),{recursive:true});await page.screenshot({path:path.join(appRoot,'../../docs/brand-catalog/desktop-'+width+'.png'),fullPage:true});
 await combo.press('Escape');assert.equal(await combo.getAttribute('aria-expanded'),'false');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await page.close();}
});
