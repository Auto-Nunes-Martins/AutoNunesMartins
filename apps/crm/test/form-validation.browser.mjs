// Hydrate the real phase-one form; enhanced-action failures are local fixtures.
// No vehicle is created and each page uses an isolated browser context.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
let directory, vite, server, browser, origin;
before(async () => {
  const cache = path.join(appRoot, '.svelte-kit');
  await mkdir(cache, { recursive: true });
  directory = await mkdtemp(path.join(cache, 'form-validation-browser-'));
  const write = (name, value) => writeFile(path.join(directory, name), value);
  await write('package.json', '{"type":"module"}');
  await write('review.css', "@import '../../src/app.css';\n@source '../../src';");
  await mkdir(path.join(appRoot, '.svelte-kit/validation-review'), { recursive: true });
  await write(
    'App.svelte',
    `<script>
import {onMount} from 'svelte';
import NewVehicleDraftForm from '$review/NewVehicleDraftForm.svelte';
import {showFormErrors} from '$lib/forms/formFeedback';
onMount(()=>{window.validationSubmissions=0;window.validationToasts=[];window.showValidation=failure=>showFormErrors(document.querySelector('form'),failure);});
</script><main><NewVehicleDraftForm draftOwner="isolated-validation-test"/></main>`,
  );
  await write(
    'Icon.svelte',
    '<script>let {size=16,class:className=""}=$props();</script><svg width={size} height={size} class={className} aria-hidden="true"></svg>',
  );
  await write(
    'icons.js',
    "export {default as CalendarDays,default as ChevronLeft,default as ChevronRight, default as CarFront, default as Gauge, default as Fuel, default as Car, default as SprayCan} from './Icon.svelte';",
  );
  await write(
    'client.js',
    `import './review.css';import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app')});window.reviewReady=true;`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export function html(){return render(App).body;}`,
  );
  await write('navigation.js', 'export const goto=async()=>{};');
  await write('paths.js', "export const base='';");
  await write(
    'toast.js',
    'export const toast={success(){},error(message){window.validationToasts.push(message)}};',
  );
  await write(
    'enhance.js',
    `export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const complete=callback({formElement:form,cancel(){cancelled=true}});if(cancelled)return;window.validationSubmissions++;await complete?.({result:{type:'failure',data:window.validationFailure??{error:'Serviço temporariamente indisponível.'}},update:async()=>{}});};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`,
  );
  server = createHttpServer(async (request, response) => {
    if (request.url === '/') {
      try {
        const module = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app">${module.html()}</div><script type="module" src="/client.js"></script></body></html>`,
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
    server: {
      hmr: { server, host: '127.0.0.1', clientPort: Number(new URL(origin).port) },
      middlewareMode: true,
      fs: {
        allow: [
          path.resolve(appRoot, '../..'),
          await realpath(path.resolve(appRoot, '../../node_modules')),
        ],
      },
    },
    optimizeDeps: { entries: ['client.js'] },
    logLevel: 'error',
  });
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
    path.basename(directory).startsWith('form-validation-browser-')
  )
    await rm(directory, { recursive: true, force: true });
});

for (const width of [390, 1366])
  test(
    'new vehicle validation names fields, deduplicates and preserves input at ' + width + 'px',
    { timeout: 60000 },
    async () => {
      const page = await browser.newPage({
          viewport: { width, height: 1000 },
          isMobile: width === 390,
          hasTouch: width === 390,
          reducedMotion: 'reduce',
        }),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.route('**/*', (route) =>
          new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
        );
        await page.goto(origin);
        await page.getByRole('button', { name: 'Guardar e continuar', exact: true }).waitFor();
        await page.waitForTimeout(100);
        await page.getByRole('button', { name: 'Guardar e continuar', exact: true }).click();
        const summary = page.locator('[data-form-error-summary]');
        await summary.waitFor();
        assert.equal(await page.locator('[data-form-error-summary]').count(), 1);
        assert(await summary.evaluate((e) => e === document.activeElement));
        const links = await summary.locator('a').allTextContents();
        assert(links.includes('Marca: Selecione uma marca registada na lista.'));
        assert(links.includes('Modelo: Indique o modelo.'));
        assert(links.includes('Combustível: Selecione uma opção.'));
        assert.equal(links.length, new Set(links.map((s) => s.split(':')[0])).size);
        assert(!links.some((s) => /^(Preencha|Selecione)/.test(s)));
        assert.equal(await page.evaluate(() => window.validationSubmissions), 0);
        await page.screenshot({
          path: path.join(appRoot, '.svelte-kit/validation-review', width + '-client.png'),
          fullPage: true,
          animations: 'disabled',
        });
        assert.equal(await summary.getAttribute('aria-live'), null);
        assert.equal(await page.locator('.crm-field-error[role="alert"]').count(), 0);
        await summary.getByRole('link', { name: 'Marca: Selecione uma marca registada na lista.', exact: true }).click();
        assert.equal(await page.evaluate(() => document.activeElement.dataset.errorField), 'brand');
        const brand = page.getByRole('combobox',{name:'Marca',exact:true});
        await brand.fill('Dacia');await page.getByRole('option',{name:'Dacia',exact:true}).click();
        assert.equal(await summary.getByRole('link', { name: /^Marca:/ }).count(), 0);
        await page.locator('[name="year"]').fill('1900');
        await page.getByRole('button', { name: 'Guardar e continuar', exact: true }).click();
        assert((await summary.locator('a').allTextContents()).includes('Ano: O mínimo é 1950.'));
        assert.equal(await brand.inputValue(), 'Dacia');
        await page.evaluate(() =>
          window.showValidation({
            error: 'Não foi possível concluir a validação.',
            issues: [
              { path: ['brand'], message: 'Required' },
              { path: ['brand'], message: 'Required' },
              { path: ['brand'], message: 'Marca não reconhecida pelo serviço.' },
              { path: ['fuel'], message: 'Invalid enum value' },
            ],
          }),
        );
        assert.equal(await summary.locator('li').count(), 2);
        assert.equal(await page.getByRole('combobox',{name:'Marca',exact:true}).getAttribute('aria-invalid'), 'true');
        assert.equal(await page.locator('label:has([name="brand"]) .crm-field-error').count(), 1);
        const serverBrand = summary.getByRole('link', { name: /^Marca:/ });
        assert((await serverBrand.textContent()).includes('Marca não reconhecida'));
        assert.equal((await serverBrand.textContent()).match(/Indique a marca/g)?.length, 1);
        await serverBrand.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => document.activeElement.dataset.errorField), 'brand');
        assert.equal(await brand.inputValue(), 'Dacia');
        assert((await summary.innerText()).includes('Não foi possível concluir a validação.'));
        await page.evaluate(() =>
          window.showValidation({ error: 'Falha de ligação. Tente novamente.' }),
        );
        assert((await summary.innerText()).includes('Falha de ligação. Tente novamente.'));
        assert.equal(await summary.locator('li').count(), 0);
        for (const [name, value] of Object.entries({
          brand: 'Dacia',
          model: 'Sandero',
          year: '2021',
          mileage: '42000',
          licensePlate: 'AA-00-AA',
          purchasePrice: '10000',
          salePrice: '15000',
        }))
          if(name==='brand'){await page.getByRole('combobox',{name:'Marca',exact:true}).fill(value);await page.getByRole('option',{name:value,exact:true}).click();}else await page.locator('[name="' + name + '"]').fill(value);
        await page.locator('[name="fuel"]').selectOption('GASOLINE');
        await page.evaluate(
          () =>
            (window.validationFailure = {
              field: 'licensePlate',
              error: 'Já existe uma viatura com esta matrícula.',
            }),
        );
        await page.getByRole('button', { name: 'Guardar e continuar', exact: true }).click();
        await page.waitForFunction(() =>
          document
            .querySelector('[data-form-error-summary]')
            ?.textContent.includes('Já existe uma viatura'),
        );
        assert.equal(await page.evaluate(() => window.validationSubmissions), 1);
        assert.deepEqual(await page.evaluate(() => window.validationToasts), []);
        assert.equal(await brand.inputValue(), 'Dacia');
        assert.equal(await page.locator('[name="model"]').inputValue(), 'Sandero');
        assert.equal(await page.locator('[name="licensePlate"]').inputValue(), 'AA-00-AA');
        assert.equal(await summary.locator('a').count(), 1);
        assert(await summary.evaluate((e) => e === document.activeElement));
        await page.screenshot({
          path: path.join(appRoot, '.svelte-kit/validation-review', width + '-server.png'),
          fullPage: true,
          animations: 'disabled',
        });
        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    },
  );
