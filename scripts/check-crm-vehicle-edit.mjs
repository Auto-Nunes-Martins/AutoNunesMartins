// Real CRM edit components in an isolated Vite harness. Only in-memory fixture writes.
// SvelteKit transport/auth are stubbed; no CRM login, database or Storage is contacted.
// PowerShell: $env:PLAYWRIGHT_CHANNEL='chrome'; node scripts/check-crm-vehicle-edit.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';

const shell=process.argv.includes('--shell');
const photoLayout=process.argv.includes('--photos');
const compactGrid=process.argv.includes('--grid');
const validation=process.argv.includes('--validation');
const root = resolve('.cache/crm-save-browser');
await mkdir(root, { recursive: true });
const id = 'c' + '1'.repeat(24);
const photo = n => `${id}/12345678-1234-1234-1234-${String(n).padStart(12, '0')}.webp`;
let vehicle = {
  id, updatedAt: '2026-10-17T10:00:00.000Z', brand: 'Teste', model: 'Modelo', year: 2022, fuel: 'DIESEL', mileage: 20000,
  vin: 'VF1RFB00712345678', licensePlate: '12-AB-34', purchasePrice: '10000.00', salePrice: '15000.00',
  acquisitionDate: '2026-01-01T00:00:00.000Z', description: 'Nota interna',
  pendingDocFlags: { financing: false, imt: false, registration: false, docs: false },
  status: 'AVAILABLE', sale: null, soldDate: null, webPublished: true,
  publicSlug: 'teste-modelo-123456abcdef', publicPrice: '15000.00', publicDescription: 'Descrição pública',
  publicTransmission: null, publicSpecifications: {}, photos: [photo(1), photo(2)], publicPhotoPaths: [photo(1)],
};
const operations = [];
let failNext = '', uploadIndex = 2; const stagedPhotos=new Set();
const state = () => ({ vehicle, signedPhotos: vehicle.photos.map(path => ({ path, url: `/__fixture/photo/${encodeURIComponent(path)}` })) });
await writeFile(root + '/index.html', '<html lang="pt-PT"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
await writeFile(root + '/fixture.css', `@import '../../apps/crm/src/app.css'; @source '../../apps/crm/src';`);
await writeFile(root + '/main.js', `import {mount} from 'svelte'; import App from './App.svelte'; const initial=await fetch('/__fixture/state').then(r=>r.json()); mount(App,{target:document.getElementById('app'),props:{initial}});`);
await writeFile(root + '/App.svelte', `<script>
import EditPage from '../../apps/crm/src/routes/(app)/viaturas/[id]/editar/+page.svelte';
import {hasUnsavedForms} from '../../apps/crm/src/lib/forms/formFeedback';
import './fixture.css';
let {initial}=$props(); function startingData(){return initial;} let data=$state(startingData());
window.__crmFixtureUpdate=next=>{data=next}; window.__crmUnsaved=hasUnsavedForms;
</script><main style="max-width:1300px;margin:auto;padding:24px"><EditPage {data}/></main>`);
if(shell)await writeFile(root+'/App.svelte',`<script>
import Topbar from '../../apps/crm/src/lib/components/shell/Topbar.svelte';
import PhotoGallery from '../../apps/crm/src/lib/components/vehicle/PhotoGallery.svelte';
import './fixture.css';
let {initial}=$props();let user=$state('user-1');function initialPhotos(){return [...initial.signedPhotos,{path:'broken',url:'/__fixture/broken'}];}let photos=$state(initialPhotos());window.__galleryCount=n=>photos=initialPhotos().slice(0,n);
</script><button type="button" onclick={()=>user='user-2'}>Trocar utilizador</button><Topbar userKey={user}/><main style="max-width:1100px;margin:auto;padding:20px"><PhotoGallery vehicleId={initial.vehicle.id} {photos} editable={false} publicPaths={initial.vehicle.publicPhotoPaths} published={true}/></main>`);
await writeFile(root + '/navigation.js', `export async function invalidateAll(){const data=await fetch('/__fixture/state').then(r=>r.json());window.__crmFixtureUpdate(data);await new Promise(r=>setTimeout(r,0));} export async function goto(url){window.__lastGoto=url;history.pushState({},'',url);}`);
await writeFile(root + '/forms.js', `import {invalidateAll} from './navigation.js';
export function enhance(form,submit){const listener=async event=>{event.preventDefault();if(!form.reportValidity())return;const formData=new FormData(form);let cancelled=false;const handler=submit({formElement:form,formData,submitter:event.submitter,cancel(){cancelled=true;}});if(cancelled)return;let result;try{result=await fetch(form.action,{method:'POST',body:new URLSearchParams(formData)}).then(r=>r.json());}catch{result={type:'failure',data:{error:'Falha de rede simulada'}};}await handler?.({result,update:async({invalidateAll:reload=true}={})=>{if(reload&&result.type==='success')await invalidateAll();}});};form.addEventListener('submit',listener);return{destroy(){form.removeEventListener('submit',listener)}};}`);
await writeFile(root+'/stores.js', `import {writable} from 'svelte/store';export const page=writable({url:new URL(location.href),data:{}});`);
await writeFile(root+'/environment.js', `export const browser=true;`);
await writeFile(root + '/paths.js', `export const base='';`);
await writeFile(root + '/public-env.js', `export const PUBLIC_WEBSITE_URL='https://website.invalid';`);
const fixture = {
  name: 'in-memory-crm-fixture',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url, 'http://fixture');
      const json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      if(url.pathname==='/api/search') {const q=url.searchParams.get('q');await new Promise(resolve=>setTimeout(resolve,q==='old'?350:20));if(q==='error'){res.statusCode=503;json({error:'Fixture failure'});return;}json({q,vehicles:q==='empty'?[]:[{id:q,primary:q+' fixture',secondary:'Viatura de teste',href:'/viaturas/'+q}],customers:[],tasks:[],total:q==='empty'?0:1});return;}
      if(url.pathname==='/api/notifications'){json({alerts:{stockAged:0,tasksDueOrOverdue:0,remindersToday:0,draftVehicles:0},total:0,recent:[]});return;}
      if(url.pathname==='/__fixture/broken'){res.statusCode=503;res.end();return;}
      if (url.pathname.startsWith('/__fixture/photo/')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        const portrait=url.pathname.includes('000000000002');
        res.end((portrait?'<svg width="300" height="900" ': '<svg width="640" height="400" ')+ 'xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#495d70"/><text x="40" y="200" fill="white" font-size="34">Fotografia de teste</text></svg>'); return;
      }
      if (url.pathname === '/__fixture/state' || (req.method === 'GET' && url.pathname.endsWith('/editar/save'))) { json(state()); return; }
      if (req.method !== 'POST' && req.method !== 'DELETE') { next(); return; }
      let body = ''; for await (const chunk of req) body += chunk;
      if (url.pathname === '/__fixture/control') { const control=JSON.parse(body);failNext = control.failNext;if(control.bumpVersion)vehicle.updatedAt=new Date(Date.parse(vehicle.updatedAt)+1).toISOString();if(control.clearPhotos){vehicle.photos=[];vehicle.publicPhotoPaths=[];}if(control.photoCount!==undefined)vehicle.photos=Array.from({length:control.photoCount},(_,i)=>photo(i+1));json({ ok: true }); return; }
      const form = new URLSearchParams(body);
      const operation = url.pathname.endsWith('/editar/save') ? 'unified' : url.pathname.endsWith('/reorder') ? 'photoReorder'
        : url.pathname.endsWith('/photos') ? 'photoUpload'
        : req.method === 'DELETE' ? 'photoDelete'
        : url.search.includes('/webPublication') ? form.get('operation') === 'remove' ? 'remove' : 'publication'
        : url.search.includes('/submit') ? 'details' : '';
      if (!operation) { next(); return; }
      operations.push({ operation, fields: operation.startsWith('photo') ? [] : operation==='unified' ? JSON.parse(body) : [...form.entries()] });
      await new Promise(resolve => setTimeout(resolve, 180));
      if (failNext === operation) {
        failNext = ''; res.statusCode = 400;
        json(operation.startsWith('photo') || operation === 'unified' ? { error: 'Falha simulada' } : { type: 'failure', data: { error: 'Falha simulada' } }); return;
      }
      if (operation === 'photoUpload') {const path=id+'/'+req.headers['x-upload-id']+'.webp';stagedPhotos.add(path);json({path,staged:true});return;}
      if (operation === 'unified') {const input=JSON.parse(body);assert.equal(input.expectedUpdatedAt,vehicle.updatedAt);vehicle={...vehicle,...input.data,photos:input.photos,publicPhotoPaths:input.photos.filter(p=>vehicle.publicPhotoPaths.includes(p)),updatedAt:new Date(Date.parse(vehicle.updatedAt)+1).toISOString()};if(input.publication)vehicle={...vehicle,webPublished:input.publication.published,publicPrice:input.publication.price,publicDescription:input.publication.description,publicPhotoPaths:input.publication.photoPaths};json({ok:true});return;}
      if (operation === 'photoReorder') {
        vehicle.photos = JSON.parse(body).photos;
        vehicle.publicPhotoPaths = vehicle.photos.filter(path => vehicle.publicPhotoPaths.includes(path));
      }
      if (operation === 'photoDelete') {
        const path = decodeURIComponent(url.pathname.split('/photos/')[1]);
        vehicle.photos = vehicle.photos.filter(p => p !== path);
        vehicle.publicPhotoPaths = vehicle.publicPhotoPaths.filter(p => p !== path);
      }
      if (operation === 'details') for (const key of ['brand', 'model', 'description']) vehicle[key] = form.get(key);
      if (operation === 'publication') {
        vehicle.webPublished = true; vehicle.publicPhotoPaths = form.getAll('publicPhotoPaths');
        vehicle.publicPrice = form.get('publicPrice'); vehicle.publicDescription = form.get('publicDescription');
      }
      if (operation === 'remove') vehicle.webPublished = false;
      json(operation.startsWith('photo') ? { photos: vehicle.photos } : { type: 'success', data: { id } });
    });
  },
};
const server = await createServer({
  configFile: false, root, cacheDir: root + '/vite-cache',
  plugins: [fixture, tailwindcss(), svelte({ configFile: false })],
  resolve: { alias: {
    '$lib': resolve('apps/crm/src/lib'), '$app/forms': root + '/forms.js',
    '$app/navigation': root + '/navigation.js', '$app/stores':root+'/stores.js','$app/environment':root+'/environment.js', '$app/paths': root + '/paths.js', '$env/static/public': root + '/public-env.js',
  } },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [resolve('.'), await realpath('node_modules')] } },
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('dialog', dialog => dialog.accept());
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.log('Browser error:',error.message); });
  await page.goto(origin);

  if(shell){
    let input=page.getByRole('combobox',{name:'Pesquisar',exact:true}).filter({visible:true});await input.waitFor();await input.focus();
    const list=page.getByRole('listbox',{name:'Recentes e acesso rápido'});assert(await list.isVisible());assert.equal(await list.getByRole('option').count(),5);
    await input.press('ArrowDown');const active=await input.getAttribute('aria-activedescendant');assert(active);assert(await page.locator('[id="'+active+'"]').isVisible());
    await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');assert.equal(await input.evaluate(el=>el===document.activeElement),true);
    await input.click();await input.press('ArrowDown');await input.press('Enter');await page.waitForFunction(()=>location.pathname==='/viaturas');
    await input.click();assert(await page.getByRole('group',{name:'Recentes nesta sessão'}).isVisible());
    const optionIds=await page.getByRole('option').evaluateAll(options=>options.map(o=>o.id));assert.equal(new Set(optionIds).size,optionIds.length);
    await page.getByRole('button',{name:'Limpar recentes',exact:true}).click();assert.equal(await page.getByRole('group',{name:'Recentes nesta sessão'}).count(),0);
    await input.fill('old');await page.waitForTimeout(200);await input.fill('new');await page.getByRole('option',{name:/new fixture/}).waitFor();await page.waitForTimeout(400);assert.equal(await page.getByRole('option',{name:/old fixture/}).count(),0);
    await input.fill('error');await page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();
    await input.fill('empty');await page.getByRole('status').filter({hasText:'Sem resultados para esta pesquisa.'}).waitFor();
    await page.getByRole('button',{name:'Limpar pesquisa',exact:true}).click();assert(await list.isVisible());
    await input.press('ArrowDown');await input.press('Enter');await input.click();assert(await page.getByRole('group',{name:'Recentes nesta sessão'}).isVisible());await page.getByRole('button',{name:'Trocar utilizador',exact:true}).click();await input.click();assert.equal(await page.getByRole('group',{name:'Recentes nesta sessão'}).count(),0);
    await input.press('Escape');
    const bell=page.getByRole('button',{name:'Alertas',exact:true});await bell.click();const alerts=page.getByRole('dialog',{name:'Alertas',exact:true});await alerts.getByText('Sem alertas',{exact:true}).waitFor();await page.getByRole('button',{name:'Fechar alertas',exact:true}).click();assert.equal(await bell.evaluate(el=>el===document.activeElement),true);
    const main=page.locator('.photo-preview'),next=main.getByRole('button',{name:'Fotografia seguinte',exact:true}),previous=main.getByRole('button',{name:'Fotografia anterior',exact:true});
    assert(await previous.isDisabled());await next.click();assert(await previous.isEnabled());
    const opener=main.getByRole('button',{name:'Ampliar fotografia 2 de 3',exact:true});await opener.click();const viewer=page.getByRole('dialog',{name:'Fotografia 2 de 3',exact:true});await viewer.waitFor();
    const box=await viewer.boundingBox();assert(Math.abs(box.x+box.width/2-720)<1);assert(Math.abs(box.y+box.height/2-500)<1);
    assert.equal(await viewer.locator('img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
    for(let i=0;i<7;i++){await page.keyboard.press('Tab');assert.equal(await viewer.evaluate(dialog=>dialog.contains(document.activeElement)),true);}
    await page.keyboard.press('ArrowRight');await page.getByRole('dialog',{name:'Fotografia 3 de 3',exact:true}).waitFor();
    await page.getByRole('dialog',{name:'Fotografia 3 de 3',exact:true}).getByRole('status').waitFor();
    assert(await page.getByRole('dialog').getByRole('button',{name:'Fotografia seguinte',exact:true}).isDisabled());
    await page.keyboard.press('ArrowRight');assert.equal(await main.locator('.photo-count').innerText(),'3 / 3');
    await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');assert.equal(await main.locator('.photo-count').innerText(),'1 / 3');
    await page.screenshot({path:'.cache/crm-save/gallery-desktop.png'});await page.keyboard.press('Escape');assert.equal(await main.getByRole('button',{name:'Ampliar fotografia 1 de 3',exact:true}).evaluate(el=>el===document.activeElement),true);
    await page.setViewportSize({width:390,height:844});await main.getByRole('button',{name:'Ampliar fotografia 1 de 3',exact:true}).click();const mobileBox=await page.getByRole('dialog').boundingBox();assert(mobileBox.x>=0&&mobileBox.x+mobileBox.width<=391);assert(Math.abs(mobileBox.y+mobileBox.height/2-422)<1);await page.screenshot({path:'.cache/crm-save/gallery-mobile.png'});await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Pesquisar',exact:true}).click();await input.waitFor();assert.equal(await input.evaluate(el=>el===document.activeElement),true);assert(await page.getByRole('listbox').isVisible());await page.screenshot({path:'.cache/crm-save/search-mobile.png'});await page.getByRole('button',{name:'Fechar pesquisa',exact:true}).click();
    await page.getByRole('button',{name:'Pesquisar',exact:true}).click();await input.press('ArrowDown');await input.press('Enter');await page.getByRole('button',{name:'Fechar pesquisa',exact:true}).click();await page.getByRole('button',{name:'Pesquisar',exact:true}).click();assert(await page.getByRole('group',{name:'Recentes nesta sessão'}).isVisible());await page.getByRole('button',{name:'Fechar pesquisa',exact:true}).click();
    await page.evaluate(()=>window.__galleryCount(1));assert.equal(await main.getByRole('button',{name:'Fotografia seguinte',exact:true}).count(),0);await main.getByRole('button',{name:'Ampliar fotografia 1 de 1',exact:true}).click();assert.equal(await page.getByRole('dialog').getByRole('button',{name:'Fotografia seguinte',exact:true}).count(),0);await page.keyboard.press('Escape');
    await page.evaluate(()=>window.__galleryCount(0));assert.equal(await main.count(),0);await page.getByText('Sem fotografias · use «Editar fotografias» para adicionar',{exact:true}).waitFor();
    assert.deepEqual(errors,[]);console.log('PASS shell and gallery: empty search context, recents/privacy and mobile reopen, keyboard, race/error/empty, alerts, gallery bounds/centering/contain/focus/scroll and zero/one photos');
  }else if(validation){
    const save=page.getByRole('button',{name:'Guardar alterações',exact:true}),cards=page.locator('.photo-card');await cards.nth(1).waitFor();
    const initial=structuredClone(vehicle);
    await cards.first().getByRole('checkbox').click();await cards.first().getByText(/Esta é a foto principal/).waitFor();assert.equal(await cards.first().locator('.visibility').innerText(),'No site');
    await save.click();await page.locator('.edit-errors').waitFor();assert(await cards.first().getByRole('checkbox').evaluate(el=>el===document.activeElement));assert.equal(await cards.first().getByRole('checkbox').getAttribute('aria-invalid'),'true');assert.equal(operations.length,0);assert.deepEqual(vehicle,initial);
    await cards.first().getByRole('checkbox').click();await page.waitForTimeout(60);assert.equal(await page.locator('.edit-errors').count(),0);assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
    await cards.nth(1).getByRole('button',{name:/Definir fotografia.*como principal/}).click();await save.click();assert(await cards.first().getByRole('checkbox').evaluate(el=>el===document.activeElement));assert.equal(operations.length,0);
    await cards.first().getByRole('checkbox').click();await page.locator('[name="licensePlate"]').fill('');
    await page.request.post(origin+'/__fixture/control',{data:{failNext:'unified'}});await save.click();await page.waitForFunction(()=>document.querySelector('.edit-message')?.textContent.includes('Falha simulada'));assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal · por guardar');assert.deepEqual(vehicle,initial);
    await save.click();await page.waitForFunction(()=>document.querySelector('.edit-message')?.textContent.includes('Todas as alterações foram guardadas'));assert.equal(vehicle.licensePlate,null);assert.equal(vehicle.photos[0],photo(2));assert.equal(vehicle.publicPhotoPaths[0],photo(2));assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
    await page.setViewportSize({width:390,height:844});await page.locator('[name="brand"]').fill('');await page.locator('[name="publicPrice"]').fill('-1');await page.locator('[name="publicDescription"]').fill('');
    const count=operations.length;await save.click();assert.equal(await page.locator('.edit-errors button').count(),3);assert(await page.locator('[name="brand"]').evaluate(el=>el===document.activeElement));
    await page.locator('.edit-errors button').filter({hasText:'Preço público'}).click();assert(await page.locator('[name="publicPrice"]').evaluate(el=>el===document.activeElement));assert.equal(await page.locator('[name="publicPrice"]').getAttribute('aria-invalid'),'true');assert(await page.locator('[name="publicPrice"]').getAttribute('aria-describedby'));assert.equal(operations.length,count);
    await page.screenshot({path:'.cache/crm-save/validation-mobile.png',fullPage:true});
    await page.locator('[name="brand"]').fill('Marca corrigida');await page.locator('[name="publicPrice"]').fill('22000');await page.locator('[name="publicDescription"]').fill('Descrição corrigida');
    for(const checkbox of await cards.getByRole('checkbox').all()){if(await checkbox.getAttribute('aria-checked')==='true')await checkbox.click();}
    await save.click();assert.equal(operations.length,count);await page.locator('.edit-errors').getByText(/A foto principal não está selecionada/).waitFor();assert(await cards.first().getByRole('checkbox').evaluate(el=>el===document.activeElement));assert.deepEqual(vehicle.publicPhotoPaths,[photo(2),photo(1)]);assert.equal(await page.locator('[name="publicDescription"]').inputValue(),'Descrição corrigida');assert.deepEqual(errors,[]);
    console.log('PASS guided validation: principal deselection/private principal, immediate warning, focus and inline/summary errors, multiple invalid fields, blank plate, failure/retry, same CRM/public principal, no premature approval or discarded draft');
  }else if(compactGrid){
    await page.request.post(origin+'/__fixture/control',{data:{photoCount:12}});await page.reload();
    const section=page.locator('.photo-draft'),port=section.locator('.photo-grid-scroll'),cards=section.locator('.photo-card');
    const expand=section.getByRole('button',{name:/Expandir fotografias|Recolher fotografias/}),collapse=expand;
    await cards.nth(11).waitFor();const original=[...vehicle.photos];
    assert(await section.locator('.photo-grid-frame > :first-child .add-photo-card').count());assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
    assert.equal(await port.evaluate(el=>el.scrollTop),0);assert(await page.getByRole('button',{name:'Guardar alterações',exact:true}).isDisabled());
    assert.equal(await expand.count(),0);const previewBounds=await section.locator('.cover-preview').boundingBox(),organizeBounds=await section.locator('.organize-panel').boundingBox();assert(previewBounds.width>=240&&previewBounds.width<=321);assert(previewBounds.height>=180&&previewBounds.height<=330);assert(organizeBounds.x>=previewBounds.x+previewBounds.width+19,'preview stays left of organization');
    const visibleCount=await port.evaluate(el=>{const p=el.getBoundingClientRect();return[...el.querySelectorAll('.photo-card')].filter(card=>{const r=card.getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom;}).length;});assert(visibleCount>=8,`useful desktop overview: ${visibleCount} complete cards`);
    const keyboardSwap=async(index,direction)=>{await cards.nth(index).focus();await page.keyboard.press('Space');await page.keyboard.press(direction);await page.keyboard.press('Space');await page.waitForTimeout(180);};
    await keyboardSwap(1,'ArrowRight');assert.equal(await cards.nth(1).getAttribute('data-photo-path'),photo(3));assert.equal(await cards.nth(2).getAttribute('data-photo-path'),photo(2));
    await keyboardSwap(2,'ArrowLeft');assert.deepEqual(await cards.evaluateAll(nodes=>nodes.map(el=>el.dataset.photoPath)),original);assert(await page.getByRole('button',{name:'Guardar alterações',exact:true}).isDisabled());
    const a=await cards.nth(1).boundingBox(),b=await cards.nth(2).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+35);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+35,{steps:15});await page.waitForTimeout(250);await page.mouse.up();await page.waitForTimeout(220);
    assert.equal(await cards.nth(1).getAttribute('data-photo-path'),photo(3),'pointer drag reorders the local draft');await keyboardSwap(2,'ArrowLeft');assert.deepEqual(await cards.evaluateAll(nodes=>nodes.map(el=>el.dataset.photoPath)),original);assert.equal(operations.length,0);
    await port.focus();await port.press('End');await page.waitForTimeout(120);await port.evaluate(el=>el.scrollTop=0);
    await section.screenshot({path:'.cache/crm-save/grid-compact-desktop.png'});
    const upload=section.getByRole('button',{name:'Escolher fotografias',exact:true});await upload.focus();
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
    await section.locator('input[type="file"]').setInputFiles([...Array.from({length:3},(_,i)=>({name:`nova-${i}.png`,mimeType:'image/png',buffer:png})),{name:'invalido.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')}]);
    await cards.nth(14).waitFor();await page.waitForTimeout(260);assert.equal(await collapse.count(),0);const scrollMetrics=await port.evaluate(el=>({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight,last:el.querySelector('.photo-grid .photo-card:last-child')?.getBoundingClientRect().bottom,bottom:el.getBoundingClientRect().bottom}));assert(scrollMetrics.total<=scrollMetrics.height+2||scrollMetrics.top>0,JSON.stringify(scrollMetrics));
    assert(await upload.evaluate(el=>el===document.activeElement));const notice=section.getByRole('complementary',{name:'Resultado da seleção de fotografias'});
    await notice.getByText('Fotografias adicionadas ao rascunho',{exact:true}).waitFor();assert.equal(await notice.locator('img').count(),3);await notice.getByText('Falta guardar alterações.',{exact:true}).waitFor();await notice.getByText('1 ficheiro não adicionado.',{exact:true}).waitFor();
    const paths=await cards.evaluateAll(nodes=>nodes.map(el=>el.dataset.photoPath));assert.deepEqual(paths.slice(0,12),original);assert(paths.slice(12).every(path=>path.startsWith('draft:')));assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
    assert.deepEqual(vehicle.photos,original);assert.deepEqual(vehicle.publicPhotoPaths,[photo(1)]);assert.equal(operations.length,0);
    await page.setViewportSize({width:390,height:844});await section.screenshot({path:'.cache/crm-save/grid-notice-mobile.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await notice.getByRole('button',{name:'Fechar notificação de fotografias',exact:true}).click();assert.equal(await notice.count(),0);assert(await cards.last().locator('img').evaluate(img=>img.complete&&img.naturalWidth>0));
    await section.locator('input[type="file"]').setInputFiles({name:'recusado.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});await notice.getByText('Não foi adicionada nenhuma fotografia',{exact:true}).waitFor();assert.equal(await notice.getByText('Falta guardar alterações.',{exact:true}).count(),0);assert.equal(await cards.count(),15);
    await section.locator('input[type="file"]').setInputFiles([]);assert.equal(await notice.getByText('Fotografias adicionadas ao rascunho',{exact:true}).count(),0);
    await page.setViewportSize({width:390,height:400});await page.waitForTimeout(80);assert((await port.boundingBox()).height<=273);
    for(let i=14;i>=0;i--)await cards.nth(i).getByRole('button',{name:`Eliminar fotografia ${i+1}`,exact:true}).click();
    await page.waitForTimeout(100);assert.equal(await expand.count(),0);assert.equal(await collapse.count(),0);assert.equal(await cards.count(),0);assert.equal(operations.length,0);assert.deepEqual(vehicle.photos,original);assert.deepEqual(errors,[]);
    console.log(`PASS dense overview: ${visibleCount} complete desktop cards, intermediate left preview, pointer and keyboard reorder/reversal, bounded scroll/resize, grouped notice, no expansion/focus theft or writes`);
  }else if(photoLayout){
    const section=page.locator('.photo-draft'),cards=section.locator('.photo-card'),cover=section.locator('.cover-preview img');
    await cards.nth(1).waitFor();assert.equal(await cover.getAttribute('src'),await cards.first().locator('img').getAttribute('src'));
    assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
    const checkCoverReduction=async()=>{const bounds=await section.locator('.cover-preview').boundingBox();assert(bounds.height<=330);assert(bounds.width<=321);assert.equal(await cover.evaluate(el=>getComputedStyle(el).objectFit),'contain');};
    await checkCoverReduction();
    assert.equal(await section.locator('input[type="file"]').count(),1);assert.equal(await section.locator('.photo-upload').count(),0);
    const addCard=section.getByRole('button',{name:'Adicionar fotografias Escolher uma ou várias',exact:true});assert(await addCard.isVisible());
    const grid=section.locator('.photo-grid-frame');assert(await grid.locator(':scope > :first-child button').evaluate(el=>el.classList.contains('add-photo-card')));
    assert.equal(await page.getByRole('link',{name:'← Voltar à ficha da viatura',exact:true}).evaluate(el=>getComputedStyle(el).textDecorationLine),'none');
    await cards.first().getByRole('checkbox',{name:/Selecionada para o site/}).click();
    assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
    assert.match(await cards.first().locator('.pending-visibility').innerText(),/Retirar só do site.*Mantém-se no CRM/);
    assert.equal(await cards.count(),2);assert.deepEqual(vehicle.photos,[photo(1),photo(2)]);assert.deepEqual(vehicle.publicPhotoPaths,[photo(1)]);assert.equal(operations.length,0);
    await cards.nth(1).getByRole('button',{name:/Definir fotografia.*como principal/}).click();
    assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal · por guardar');
    await cards.nth(1).getByRole('button',{name:/Definir fotografia.*como principal/}).click();assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');await cards.nth(1).getByRole('button',{name:/Definir fotografia.*como principal/}).click();
    assert.equal(await cover.getAttribute('src'),await cards.first().locator('img').getAttribute('src'));assert((await cover.getAttribute('src')).includes(encodeURIComponent(photo(2))));
    await section.screenshot({path:'.cache/crm-save/photos-rework-desktop.png'});
    await page.setViewportSize({width:390,height:844});await section.screenshot({path:'.cache/crm-save/photos-rework-mobile.png'});
    await checkCoverReduction();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.request.post(origin+'/__fixture/control',{data:{clearPhotos:true}});await page.reload();await section.getByText('A foto principal aparece aqui',{exact:true}).waitFor();assert.equal(await cards.count(),0);
    await section.screenshot({path:'.cache/crm-save/photos-empty-mobile.png'});
    const chooser=page.waitForEvent('filechooser');await section.getByRole('button',{name:'Escolher fotografias',exact:true}).click();
    await(await chooser).setFiles({name:'nova.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    await cards.first().waitFor();assert((await cover.getAttribute('src')).startsWith('blob:'));assert.equal(await cards.first().locator('.visibility').innerText(),'Só no CRM');
    await section.getByText('1 fotografia nova por guardar',{exact:true}).waitFor();assert.equal(operations.length,0);assert.deepEqual(vehicle.photos,[]);
    await addCard.focus();const keyboardChooser=page.waitForEvent('filechooser');await addCard.press('Enter');await(await keyboardChooser).setFiles({name:'segunda.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});await cards.nth(1).waitFor();assert.equal(operations.length,0);assert.deepEqual(vehicle.photos,[]);
    await cards.nth(1).getByRole('button',{name:'Eliminar fotografia 2',exact:true}).click();
    await cards.first().getByRole('button',{name:'Eliminar fotografia 1',exact:true}).click();await section.getByText('A foto principal aparece aqui',{exact:true}).waitFor();assert.equal(operations.length,0);
    assert.deepEqual(errors,[]);console.log('PASS photo layout: draft cover, site-only withdrawal, desktop/mobile, accessible file chooser, zero photos, local addition/deletion and no writes before Save');
  }else{
  const save=page.getByRole('button',{name:'Guardar alterações',exact:true});
  const brand=page.locator('[name="brand"]'), description=page.locator('[name="publicDescription"]');
  const cards=page.locator('.photo-card');
  await save.waitFor();await page.waitForFunction(()=>document.querySelectorAll('.photo-card').length===2);
  assert(await save.isDisabled());
  assert.equal(await page.getByRole('button',{name:/Guardar publicação|Guardar dados/}).count(),0);
  assert.equal(await page.getByRole('link',{name:'← Voltar à ficha da viatura',exact:true}).getAttribute('href'),'/viaturas/'+id);
  assert((await page.getByRole('heading',{name:'Fotografias',exact:true}).boundingBox()).y<(await page.getByRole('heading',{name:'Identificação da viatura',exact:true}).boundingBox()).y);
  await brand.fill('Teste alterado');await description.fill('Nova descrição pública');
  await cards.nth(1).getByRole('checkbox',{name:/Incluir no site/}).click();
  assert.equal(await cards.nth(1).locator('.visibility').innerText(),'Só no CRM');
  await cards.nth(1).getByRole('button',{name:/Definir fotografia.*como principal/}).click();
  assert.equal(operations.length,0,'cover/selection are local drafts');
  await page.locator('input[type="file"]').setInputFiles({name:'nova.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await page.waitForFunction(()=>document.querySelectorAll('.photo-card').length===3);
  assert.equal(operations.length,0,'choosing a file does not upload or associate it');
  await cards.nth(1).getByRole('button',{name:/Eliminar fotografia/}).click();
  assert.equal(operations.length,0,'delete stays local until Save');
  assert.deepEqual(vehicle.photos,[photo(1),photo(2)]);
  await page.request.post(origin+'/__fixture/control',{data:{failNext:'unified'}});
  await save.click();assert(await brand.isDisabled());
  await page.waitForFunction(()=>document.querySelector('.edit-message')?.textContent.includes('Falha simulada'));
  assert.equal(vehicle.brand,'Teste');assert.equal(vehicle.publicDescription,'Descrição pública');
  assert.deepEqual(vehicle.photos,[photo(1),photo(2)]);assert.deepEqual(vehicle.publicPhotoPaths,[photo(1)]);
  assert.equal(stagedPhotos.size,1,'uploaded bytes remain unassociated/private after failed final save');
  assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal · por guardar');
  assert.equal(await brand.inputValue(),'Teste alterado');assert(await save.isEnabled());
  const uploads=operations.filter(o=>o.operation==='photoUpload').length;
  await save.click();await page.waitForFunction(()=>document.querySelector('.edit-message')?.textContent.includes('Todas as alterações foram guardadas'));
  assert.equal(vehicle.brand,'Teste alterado');assert.equal(vehicle.publicDescription,'Nova descrição pública');
  assert.equal(vehicle.photos.length,2);assert.equal(vehicle.photos[0],photo(2));assert.deepEqual(vehicle.publicPhotoPaths,[photo(2)]);
  assert.equal(operations.filter(o=>o.operation==='photoUpload').length,uploads,'retry reuses confirmed staged upload');
  assert(await save.isDisabled());assert.equal(await page.evaluate(()=>window.__crmUnsaved()),false);
  assert.equal(await cards.first().locator('.primary-badge').innerText(),'Foto principal');
  assert.equal(await cards.first().locator('.visibility').innerText(),'No site');
  assert.equal(await cards.nth(1).locator('.visibility').innerText(),'Só no CRM');
  const count=operations.length;
  await page.locator('form[data-edit-vehicle]').evaluate(form=>form.requestSubmit());await page.waitForTimeout(250);assert.equal(operations.length,count,'clean Enter cannot submit');
  await brand.fill('');assert(await save.isEnabled());await save.click();assert(await brand.evaluate(el=>el===document.activeElement));assert.equal(await brand.getAttribute('aria-invalid'),'true');await brand.fill('Teste alterado');await page.waitForTimeout(50);assert(await save.isDisabled());
  await page.screenshot({path:'.cache/crm-save/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert((await page.getByRole('heading',{name:'Fotografias',exact:true}).boundingBox()).y<(await page.getByRole('heading',{name:'Identificação da viatura',exact:true}).boundingBox()).y);
  await page.screenshot({path:'.cache/crm-save/mobile.png',fullPage:true});
  await brand.fill('Rascunho concorrente');await page.request.post(origin+'/__fixture/control',{data:{bumpVersion:true}});
  const before=operations.length;await save.click();await page.waitForFunction(()=>document.querySelector('.edit-message')?.textContent.includes('alterada entretanto'));
  assert.equal(operations.length,before);assert.equal(await brand.inputValue(),'Rascunho concorrente');
  await page.reload();await save.waitFor();await page.waitForFunction(()=>!window.__crmUnsaved());await brand.fill('Gravado sem confirmação');
  await page.route('**/editar/save',async route=>{if(route.request().method()==='POST'){await route.fetch();await route.abort('failed');}else await route.continue();});
  await save.click();await page.waitForFunction(()=>document.querySelector('.edit-message')?.textContent.includes('Não foi possível confirmar o resultado'));
  assert.equal(vehicle.brand,'Gravado sem confirmação');assert.equal(await brand.inputValue(),'Gravado sem confirmação');assert(await save.isDisabled());assert(await brand.isDisabled());
  assert.equal(await page.getByText(/não foram associados à viatura nem publicados/).count(),0,'uncertain acknowledgement cannot claim the save did not commit');
  assert.deepEqual(errors,[]);
  await writeFile('.cache/crm-save/browser-report.json',JSON.stringify({operations,errors,fixtureOnly:true},null,2));
  console.log('PASS unified edit: one Save, local photo staging, atomic failure/retry, private upload reuse, clean/invalid states, conflicts, lost acknowledgement, persisted badges and desktop/mobile order');
  }
} finally { await browser?.close(); await server.close(); }
