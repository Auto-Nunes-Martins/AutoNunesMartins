import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { createServer } from 'vite';

test('campaign order persists, animates and leaves prices and duration intact', { timeout: 60_000 }, async () => {
  const crm = fileURLToPath(new URL('../', import.meta.url));
  const output = path.join(crm, '.svelte-kit');
  await mkdir(output, { recursive: true });
  const directory = await mkdtemp(path.join(output, 'campaign-order-fixture-'));
  const candidates = [
    { id: 'a', brand: 'BMW', model: '320d Touring', year: 2021, price: '25000.00' },
    { id: 'b', brand: 'Audi', model: 'A4 Avant', year: 2022, price: '30000.00' },
    { id: 'c', brand: 'Porsche', model: '911 Carrera', year: 2023, price: '85000.00' },
  ];
  const editor = { revision: 'initial', candidates, items: candidates.slice(0, 2).map((v) => ({
    vehicleId: v.id, price: String(Number(v.price) - 2500), durationDays: 7,
    applied: true, referencePrice: null, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 604800000).toISOString(),
  })) };
  await Promise.all(Object.entries({
    'paths.js': "export const base = '';",
    'forms.js': `export function enhance(form, submit) { const handler=async event=>{ event.preventDefault();let cancelled=false;const formData=new FormData(form);const callback=await submit({formData,cancel(){cancelled=true}});if(cancelled)return;window.lastSubmission=Object.fromEntries(formData);await callback?.({result:{type:'success',status:200,data:{}},update:async()=>window.fixtureSave(formData)}); };form.addEventListener('submit',handler);return {destroy(){form.removeEventListener('submit',handler)}}; }`,
    'index.html': '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module" src="/client.js"></script>',
    'review.css': "@import '../../src/app.css';\n@source '../../src';",
    'client.js': "import './review.css';import {mount} from 'svelte';import App from './App.svelte';mount(App,{target:document.querySelector('#app')});",
    'App.svelte': `<script>import Campaigns from '$campaigns';import {Toaster} from 'svelte-sonner';import {bindCrmSession} from '$lib/auth/session';bindCrmSession(async()=> 'fixture-token',()=> 'fixture');let data=$state({editor:${JSON.stringify(editor)}});window.fixtureSave=(formData)=>{const payload=JSON.parse(formData.get('campaigns'));data={editor:{...data.editor,revision:String(Date.now()),items:payload.items.map(item=>({...data.editor.items.find(v=>v.vehicleId===item.vehicleId),...item,applied:true}))}}};</script><main style="padding:20px;max-width:1280px;margin:auto"><Campaigns {data}/></main><Toaster/>`,
  }).map(([name, value]) => writeFile(path.join(directory, name), value)));
  const server = await createServer({ configFile: false, root: directory, plugins: [tailwindcss(), svelte({ configFile: false })], logLevel: 'error',
    resolve: { alias: { '$lib': path.join(crm, 'src/lib'), '$campaigns': path.join(crm, 'src/routes/(app)/site/campanhas/+page.svelte'), '$app/paths': path.join(directory, 'paths.js'), '$app/forms': path.join(directory, 'forms.js') } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [path.resolve(crm, '../..')] } },
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#303e4c"/><path d="M100 400h600l-100-150H250z" fill="#aab5c0"/><circle cx="250" cy="410" r="65" fill="#161b20"/><circle cx="590" cy="410" r="65" fill="#161b20"/></svg>';
    let delayedPhoto = false;
    let releasePhoto;
    const photoGate = new Promise(resolve => { releasePhoto = resolve; });
    await page.route('**/site/destaques/fotografias?*', async route => {
      if (delayedPhoto) await photoGate;
      return route.fulfill({json:{photos:[{path:'main.jpg',url:'data:image/svg+xml,'+encodeURIComponent(svg),width:800,height:600}]}});
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
    const cards = page.locator('.campaign-card');
    await expect(cards).toHaveCount(2);
    const save = page.getByRole('button',{name:'Guardar campanhas',exact:true});
    await expect(save).toBeDisabled();
    const days = cards.first().getByRole('textbox',{name:'Duração (dias)'});
    await days.fill('');
    await expect(save).toBeEnabled();
    await days.fill('7');
    await expect(save).toBeDisabled();
    await days.fill('8');
    await expect(save).toBeEnabled();
    await days.fill('07');
    await expect(save).toBeDisabled();
    const priceInput = cards.first().getByRole('textbox',{name:'Preço de desconto (€)'});
    await priceInput.fill('22000');
    await expect(save).toBeEnabled();
    await priceInput.fill('22500,00');
    await expect(save).toBeDisabled();
    await priceInput.fill('22500.0');
    await expect(save).toBeDisabled();
    const difference = cards.first().getByRole('textbox',{name:'Diferença (€)'});
    await difference.fill('2600');
    await expect(save).toBeEnabled();
    await difference.fill('2500,00');
    await expect(save).toBeDisabled();
    await page.locator('.campaigns form').evaluate(form=>form.requestSubmit());
    assert.equal(await page.evaluate(()=>window.lastSubmission),undefined, 'unchanged form cannot submit even programmatically');
    const timer = cards.first().locator('time');
    await expect(timer).toContainText(/Termina em \d+d \d+h \d+m \d+s/);
    const firstTime = await timer.textContent();
    await expect.poll(() => timer.textContent()).not.toBe(firstTime);
    const price = await cards.first().locator('.price-context').boundingBox();
    const photo = await cards.first().locator('.card-photo .cover').boundingBox();
    assert.ok(price.x > photo.x + photo.width && price.y < photo.y + photo.height);
    assert.match(await cards.first().locator('.ribbon-label').textContent(), /−.*2.*500/);
    await page.getByRole('button',{name:'Descer campanha 1'}).click();
    await expect(cards.first()).toHaveAttribute('data-campaign-vehicle','b');
    assert.ok(await cards.evaluateAll(nodes=>nodes.some(n=>n.parentElement.getAnimations().length>0)), 'position swap is animated');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();
    const submitted = await page.evaluate(()=>JSON.parse(window.lastSubmission.campaigns));
    assert.deepEqual(submitted.items.map(i=>i.vehicleId), ['b','a']);
    assert.ok(submitted.items.every(i=>i.durationDays===7 && i.recheck===false));
    await expect(page.getByText('Ordem das campanhas atualizada')).toBeVisible();
    await page.getByRole('button',{name:'Adicionar Porsche 911 Carrera'}).click();
    await expect(cards.last().locator('.ribbon-label')).toHaveText('SALE');
    await cards.last().getByRole('textbox',{name:'Diferença (€)'}).fill('12345');
    await expect(cards.last().locator('.ribbon-label')).toHaveText(/−.*12.*345/);
    await page.getByRole('button',{name:'Subir campanha 3'}).click();
    await save.click();
    await expect(save).toBeDisabled();
    const reorderedAddition = await page.evaluate(()=>window.lastSubmission);
    assert.equal(reorderedAddition.addition,undefined,'a reordered addition must save the entire order');
    assert.deepEqual(JSON.parse(reorderedAddition.campaigns).items.map(i=>i.vehicleId),['b','c','a']);
    await expect.poll(()=>cards.evaluateAll(nodes=>nodes.every(n=>n.parentElement.getAnimations().length===0))).toBe(true);
    await page.locator('.campaigns').screenshot({path:path.join(output,'campaign-order-desktop.png')});
    await page.setViewportSize({width:390,height:1000});
    await page.locator('.campaign-row').first().screenshot({path:path.join(output,'campaign-order-mobile.png')});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const numberBox = await page.locator('.campaign-position').first().boundingBox();
    const cardBox = await cards.first().boundingBox();
    assert.ok(numberBox.x + numberBox.width < cardBox.x, 'position sits outside the card on its left');

    const mp = await cards.first().locator('.price-context').boundingBox(), mi = await cards.first().locator('.cover').boundingBox();
    assert.ok(mp.x > mi.x + mi.width && mp.y < mi.y + mi.height,'mobile base price stays beside photo');
    delayedPhoto = true;
    await cards.first().getByRole('button',{name:'Enquadrar',exact:true}).click();
    const panel = cards.first().locator('.campaign-framing');
    await expect(panel.getByText('A carregar fotografias…')).toBeVisible();
    await expect.poll(()=>panel.evaluate(n=>n.getAnimations().length)).toBe(0);
    const loadingHeight = (await panel.boundingBox()).height;
    releasePhoto();
    await expect(panel.getByText('A carregar fotografias…')).toHaveCount(0);
    assert.ok(Math.abs((await panel.boundingBox()).height-loadingHeight)<2,'campaign photo loading keeps the opening height stable');
    await cards.first().getByRole('button',{name:'Enquadrar',exact:true}).click();
    await expect(panel).toHaveCount(0);
    await cards.first().getByRole('button',{name:'Enquadrar',exact:true}).click();
    await expect.poll(()=>panel.evaluate(n=>n.getAnimations().length)).toBe(0);
    assert.ok(Math.abs((await panel.boundingBox()).height-loadingHeight)<2,'cached and first campaign opening use the same space');
    await cards.first().getByRole('button',{name:'Enquadrar',exact:true}).click();
    await expect(panel).toHaveCount(0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.getByRole('button',{name:'Descer campanha 1'}).click();
    assert.equal(await cards.evaluateAll(nodes=>nodes.some(n=>n.parentElement.getAnimations().some(a=>a.effect.getTiming().duration>0))),false);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await cards.first().getByRole('button',{name:/^Remover /}).click();
    await expect(cards).toHaveCount(2);
    assert.ok(await cards.evaluateAll(nodes=>nodes.some(n=>n.parentElement.getAnimations().length>0)), 'remaining campaigns move smoothly after removal');
    assert.deepEqual(errors,[]);
  } finally { await browser?.close(); await server.close(); }
});
