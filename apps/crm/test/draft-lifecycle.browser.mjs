// Real wizard/form/guard/delete components, isolated HTTP and IndexedDB fixtures only.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as httpServer } from 'node:http';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';

const crm = fileURLToPath(new URL('../', import.meta.url));
const id = 'c000000000000000000000001';
const vehicle = { id, brand:'BMW', model:'One', year:2020, fuel:'DIESEL', mileage:10000,
  vin:'WBA12345678912345', licensePlate:'AA-00-AA', purchasePrice:'10000', salePrice:'19000',
  status:'DRAFT', acquisitionDate:'2026-01-01', description:'Notas internas',
  pendingDocFlags:{financing:false,imt:false,registration:false,docs:false}, sale:null, soldDate:null,
  updatedAt:'2026-10-28T00:00:00.000Z', photos:[], webPublished:false,
  publicSlug:null,publicPrice:null,publicDescription:'Descrição pública.',publicTransmission:null,publicSpecifications:null };
let directory, vite, server, browser, origin, deletes, failDelete, holdSave, releaseSave;
before(async () => {
  await mkdir(path.join(crm,'.svelte-kit'),{recursive:true});
  directory = await mkdtemp(path.join(crm,'.svelte-kit/draft-lifecycle-'));
  const write = (name, value) => writeFile(path.join(directory,name),value);
  await write('package.json','{"type":"module"}');
  await write('styles.css', '@import "../../src/app.css";\n@source "../../src";');
  await write('paths.js',"export const base='';");
  await write('public.js',"export const PUBLIC_WEBSITE_URL='http://website.fixture';");
  await write('session.js',"export const sessionFetch=(...args)=>fetch(...args);export const isSessionNavigationDeferred=()=>false;");
  await write('stores.js',"import{writable}from'svelte/store';export const page=writable({url:new URL(location.href),data:{vehicle:window.fixtureVehicle}});");
  await write('navigation.js',`import{onDestroy}from'svelte';import{page}from'./stores.js';const guards=new Set();export function beforeNavigate(fn){guards.add(fn);onDestroy(()=>guards.delete(fn));}export const afterNavigate=()=>{};export async function goto(href){let cancelled=false;const to=new URL(href,location.origin);for(const guard of guards)guard({to:{url:to},from:{url:new URL(location.href)},willUnload:false,cancel(){cancelled=true;}});if(cancelled)return;history.pushState({},'',to);window.reviewDestination=to.pathname;page.set({url:to,data:{vehicle:window.fixtureVehicle}});}export const invalidateAll=async()=>window.dispatchEvent(new Event('fixture-refresh'));`);
  await write('enhance.js',`import{goto}from'./navigation.js';export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const handler=await callback({formElement:form,formData:new FormData(form),cancel(){cancelled=true;}});if(cancelled)return;const res=await fetch('/fixture/create',{method:'POST'});const result=await res.json();await handler?.({result,update:async()=>{if(result.type==='redirect')await goto(result.location);}});};form.addEventListener('submit',submit);return{destroy(){form.removeEventListener('submit',submit);}};}`);
  await write('App.svelte',`<script>
    import {page} from '$app/stores';import {goto} from '$app/navigation';
    import Wizard from '$lib/components/vehicle/VehicleCreationWizard.svelte';
    import NewForm from '$lib/components/vehicle/NewVehicleDraftForm.svelte';
    import Guard from '$lib/components/common/UnsavedChangesGuard.svelte';
    import DraftDelete from '$lib/components/vehicle/DraftDeleteButton.svelte';
    import {draftStorage} from '$lib/forms/automaticDraft';import {rememberCreatedDraft} from '$lib/components/vehicle/creationLifecycle';
    import {Toaster} from 'svelte-sonner';
    const params=new URLSearchParams(location.search);if(params.has('created'))rememberCreatedDraft('fixture', '/viaturas/nova?viatura='+window.fixtureVehicle.id);
    const realWrite=draftStorage.write;draftStorage.write=(...args)=>window.failDraftWrite?Promise.reject(Error('Fixture storage failure')):realWrite(...args);
  </script>
  <Guard/><main style="max-width:1000px;margin:auto;padding:20px">
    <button onclick={()=>goto('/viaturas')}>Ir para a lista</button>
    {#if $page.url.pathname === '/viaturas'}<h1>Lista de viaturas</h1><DraftDelete id={window.fixtureVehicle.id} label="BMW One"/>
    {:else if !$page.url.searchParams.has('viatura')}<NewForm draftOwner="fixture"/>
    {:else}<Wizard vehicle={window.fixtureVehicle} photos={[]} draftOwner="fixture"/>{/if}
  </main><Toaster/>`);
  await write('client.js',"import '$fixture/styles';import{mount}from'svelte';import App from './App.svelte';mount(App,{target:document.querySelector('#app')});window.reviewReady=true;");
  server=httpServer(async(req,res)=>{
    const url = new URL(req.url,'http://fixture');
    const json = (code,value)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(value));};
    if(url.pathname==='/fixture/create')return json(200,{type:'redirect',status:303,location:'/viaturas/nova?viatura='+id});
    if(url.pathname===`/viaturas/${id}/discard`&&req.method==='DELETE'){
      deletes.push(req.headers['x-expected-updated-at']);
      return failDelete?json(failDelete,{error:failDelete===409?'Esta ficha já não é um rascunho.':'Falha temporária. Os dados foram mantidos.'}):json(200,{ok:true});
    }
    if(url.pathname===`/viaturas/${id}/editar/save`){
      if(req.method==='GET')return json(200,{vehicle,signedPhotos:[]});
      if(holdSave){releaseSave=()=>{if(!res.writableEnded)json(400,{error:'Falha isolada de gravação.'});};return;}
      return json(400,{error:'Falha isolada de gravação.'});
    }
    if(url.pathname==='/viaturas/nova'||url.pathname==='/viaturas'){
      const html=await vite.transformIndexHtml('/',`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>window.fixtureVehicle=${JSON.stringify(vehicle)}</script><div id="app"></div><script type="module" src="/client.js"></script></body></html>`);
      res.writeHead(200,{'content-type':'text/html'});res.end(html);return;
    }
    vite.middlewares(req,res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  vite=await createServer({configFile:false,root:directory,plugins:[tailwindcss(),svelte({configFile:false})],resolve:{alias:[
    {find:'$fixture/styles',replacement:path.join(directory,'styles.css')},
    {find:'$lib/auth/session',replacement:path.join(directory,'session.js')},
    {find:'$lib/auth/enhance',replacement:path.join(directory,'enhance.js')},
    {find:'$app/navigation',replacement:path.join(directory,'navigation.js')},
    {find:'$app/stores',replacement:path.join(directory,'stores.js')},
    {find:'$app/paths',replacement:path.join(directory,'paths.js')},
    {find:'$env/static/public',replacement:path.join(directory,'public.js')},
    {find:'$lib',replacement:path.join(crm,'src/lib')},
  ]},server:{middlewareMode:true,hmr:{server,host:'127.0.0.1'},fs:{allow:[path.resolve(crm,'../..'),await realpath(path.resolve(crm,'../../node_modules'))]}},optimizeDeps:{entries:['client.js'],include:['heic-to/next']},logLevel:'error'});
  browser=await chromium.launch({headless:true,channel:'chrome'});
});
after(async()=>{await browser?.close();await vite?.close();if(server)await new Promise(resolve=>server.close(resolve));/* Keep isolated fixtures; no cleanup. */});
async function setup(query='?viatura='+id+'&created=1') {
  deletes=[];failDelete=0;holdSave=false;releaseSave=undefined;
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto(origin+'/viaturas/nova'+query);
  await page.waitForFunction(()=>document.querySelector('form[data-edit-vehicle]'));
  return{context,page};
}
test('cancel is present in both wizard steps; confirmation keeps edits; server failure retains form and retry deletes only the creation', {timeout:120000},async()=>{
  const {context,page}=await setup();
  try{
    await expect(page.getByRole('button',{name:'Cancelar criação',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'← Voltar ao passo 1',exact:true}).click();
    await page.locator('[name=model]').fill('Edição preservada');
    await page.getByRole('button',{name:'Cancelar criação',exact:true}).click();
    await page.getByRole('button',{name:'Continuar a editar',exact:true}).click();
    await expect(page.locator('[name=model]')).toHaveValue('Edição preservada');assert.equal(deletes.length,0);
    failDelete=409;
    await page.getByRole('button',{name:'Cancelar criação',exact:true}).click();
    await page.getByRole('button',{name:'Descartar criação',exact:true}).click();
    await expect(page.locator('.creation-errors[role=alert]')).toContainText('já não é um rascunho');
    await expect(page.locator('[name=model]')).toHaveValue('Edição preservada');
    failDelete=0;
    await page.getByRole('button',{name:'Descartar criação',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Lista de viaturas'})).toBeVisible();
    assert.deepEqual(deletes,[vehicle.updatedAt,vehicle.updatedAt]);
  }finally{await context.close();}
});
test('refresh retains new-creation provenance; leave without saving really deletes new draft, but preserves an existing draft', {timeout:120000},async()=>{
  for(const created of [true,false]){
    const {context,page}=await setup('?viatura='+id+(created?'&created=1':''));
    try{
      // Remove fixture bootstrap marker before refresh: the production session registry must carry it.
      await page.evaluate(()=>history.replaceState({},'','/viaturas/nova?viatura='+window.fixtureVehicle.id));
      await page.reload();
      await page.getByRole('button',{name:'← Voltar ao passo 1',exact:true}).click();
      await page.evaluate(()=>window.failDraftWrite=true);
      await page.locator('[name=model]').fill('Alteração por descartar');
      await page.getByRole('button',{name:'Ir para a lista',exact:true}).click();
      await page.getByRole('button',{name:'Sair sem guardar',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Lista de viaturas'})).toBeVisible();
      assert.equal(deletes.length,created?1:0);
    }finally{await context.close();}
  }
});
test('first step cancel only clears local draft, and leaving normally preserves a persisted creation', {timeout:120000},async()=>{
  let fixture=await setup('');
  try{
    await fixture.page.locator('[name=model]').fill('Só local');
    await fixture.page.getByRole('button',{name:'Cancelar criação',exact:true}).click();
    await fixture.page.getByRole('button',{name:'Descartar criação',exact:true}).click();
    await expect(fixture.page.getByRole('heading',{name:'Lista de viaturas'})).toBeVisible();assert.equal(deletes.length,0);
  }finally{await fixture.context.close();}
  fixture=await setup();
  try{
    await fixture.page.getByRole('button',{name:'Ir para a lista',exact:true}).click();
    await expect(fixture.page.getByRole('heading',{name:'Lista de viaturas'})).toBeVisible();assert.equal(deletes.length,0);
  }finally{await fixture.context.close();}
});
test('successful first-step response registers the new draft, including a subsequent refresh', {timeout:120000},async()=>{
  const {context,page}=await setup('');
  try{
    await page.evaluate(values=>{
      for(const [name,value] of Object.entries(values)){
        const field=document.querySelector(`[name="${name}"]`);
        if(field){field.value=String(value);field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}
      }
    },{...vehicle,status:'AVAILABLE'});
    await page.getByRole('combobox',{name:'Marca',exact:true}).fill('BMW');
    await page.getByRole('option',{name:'BMW',exact:true}).click();
    await page.getByRole('button',{name:'Guardar e continuar',exact:true}).click();
    await expect(page.getByRole('button',{name:'Concluir no CRM',exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button',{name:'Cancelar criação',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cancelar criação',exact:true}).click();
    await page.getByRole('button',{name:'Descartar criação',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Lista de viaturas'})).toBeVisible();assert.equal(deletes.length,1);
  }finally{await context.close();}
});
test('list delete is confirmed and permission failure leaves the draft available for retry', {timeout:120000},async()=>{
  const {context,page}=await setup();
  try{
    await page.getByRole('button',{name:'Ir para a lista',exact:true}).click();
    await expect(page.getByRole('button',{name:/Eliminar rascunho/})).toHaveCount(0);
    const more=page.getByRole('button',{name:'Mais opções de BMW One',exact:true});
    await more.focus();await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem',{name:'Eliminar rascunho',exact:true})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).not.toBeVisible();
    await page.getByRole('button',{name:'Manter rascunho',exact:true}).click();assert.equal(deletes.length,0);
    await expect(more).toBeFocused();
    failDelete=403;
    await more.click();
    await page.getByRole('menuitem',{name:'Eliminar rascunho',exact:true}).click();
    await page.getByRole('button',{name:'Eliminar rascunho',exact:true}).click();
    await expect(page.getByText('Sem permissão para eliminar este rascunho. Os dados foram preservados.')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    failDelete=0;
    await page.getByRole('button',{name:'Eliminar rascunho',exact:true}).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();assert.equal(deletes.length,2);
  }finally{await context.close();}
});
test('resumed draft offers an accessible destructive action on desktop and mobile in both themes', {timeout:120000},async()=>{
  const {context,page}=await setup('?viatura='+id);
  try{
    for(const width of [1280,390])for(const theme of ['dark','light']){
      await page.setViewportSize({width,height:900});
      await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
      const action=page.getByRole('button',{name:'Eliminar rascunho',exact:true});
      await expect(action).toBeVisible();
      await expect(action.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await action.focus();await expect(action).toBeFocused();
      const bounds=await action.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
      const icon=await action.locator('svg').boundingBox();
      assert.ok(Math.abs(icon.y+icon.height/2-bounds.y-bounds.height/2)<=2,'The trash icon stays aligned with the action label.');
      if(process.env.DRAFT_REVIEW_SCREENSHOTS){
        await mkdir(process.env.DRAFT_REVIEW_SCREENSHOTS,{recursive:true});
        await page.evaluate(()=>document.fonts.ready);
        await page.locator('.creation-actions').screenshot({path:path.join(process.env.DRAFT_REVIEW_SCREENSHOTS,`draft-actions-${width}-${theme}.png`)});
      }
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog',{name:'Eliminar rascunho?',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Continuar a editar',exact:true}).click();
    assert.equal(deletes.length,0);
  }finally{await context.close();}
});

test('save in flight blocks cancellation and route leaving until it settles', {timeout:120000},async()=>{
  const {context,page}=await setup();
  try{
    holdSave=true;
    await page.getByRole('button',{name:'Concluir no CRM',exact:true}).click();
    await expect(page.getByRole('button',{name:'Cancelar criação',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Ir para a lista',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Lista de viaturas'})).toHaveCount(0);assert.equal(deletes.length,0);
    await expect.poll(()=>typeof releaseSave).toBe('function');releaseSave();
    await expect(page.getByRole('button',{name:'Cancelar criação',exact:true})).toBeEnabled();
  }finally{releaseSave?.();await context.close();}
});
test('selected photos remain local until save and cancelling cannot trigger a late upload', {timeout:120000},async()=>{
  const {context,page}=await setup();let uploads=0;
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/photos'))uploads++;});
  try{
    const base64=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=400;canvas.height=250;const ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,400,250);return canvas.toDataURL('image/png').split(',')[1];});
    await page.locator('input[type=file]').first().setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')});
    await page.getByRole('button',{name:'Cancelar criação',exact:true}).click();
    await page.getByRole('button',{name:'Descartar criação',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Lista de viaturas'})).toBeVisible();
    assert.equal(deletes.length,1);assert.equal(uploads,0);
  }finally{await context.close();}
});
