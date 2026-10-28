// Actual edit page and components; requests and saved vehicles are isolated fixtures.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
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
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="gray"/></svg>');
function fixture(query = '') {
  const empty = query.includes('empty'), blocked = query.includes('blocked');
  return { vehicle: { id, brand:'BMW', model:'One', year:2020, fuel:'DIESEL', mileage:10000,
    vin:'WBA12345678912345', licensePlate:'AA-00-AA', purchasePrice:'10000', salePrice:'19000',
    status:blocked?'DOCS_PENDING':'AVAILABLE', acquisitionDate:'2026-01-01', description:'Notas internas',
    pendingDocFlags:{financing:false,imt:false,registration:false,docs:false}, sale:null, soldDate:null,
    updatedAt:'2026-10-28T00:00:00.000Z', photos:empty?[]:[photo], webPublished:query.includes('detail'),
    publicSlug:null, publicPrice:null, publicDescription:'Descrição pública confirmada.', publicTransmission:null,
    publicSpecifications:null,expenses:[{id:'expense-1',category:'REPAIR',description:'Reparação confirmada',amount:'120.00',date:'2026-10-20'}],expensesTotal:'120.00',figures:{margin:'9000.00',vatAmount:'1682.93',commission:'0.00',realProfit:'7197.07'} }, isFeatured:false,signedPhotos:empty?[]:[{path:photo,url:image}] };
}
let directory, vite, server, browser, origin;
before(async () => {
  await mkdir(path.join(appRoot,'.svelte-kit'),{recursive:true});
  directory = await mkdtemp(path.join(appRoot,'.svelte-kit/vehicle-edit-actions-'));
  const write = (name,value) => writeFile(path.join(directory,name),value);
  await write('package.json','{"type":"module"}');
  await write('review.css',"@import '../../src/app.css';\n@source '../../src';");
  await write('App.svelte',`<script>import {onMount} from 'svelte';import EditPage from '$edit';import DetailPage from '$detail';import {Toaster} from 'svelte-sonner';let {data,detail=false}=$props();onMount(()=>{const refresh=()=>{if(window.reviewNextData)data=structuredClone(window.reviewNextData);};window.addEventListener('fixture-invalidate',refresh);return()=>window.removeEventListener('fixture-invalidate',refresh);});</script><main style="max-width:1280px;margin:auto;padding:96px 20px 40px">{#if detail}<DetailPage {data}/>{:else}<EditPage {data}/>{/if}</main><Toaster/>`);
  await write('client.js',`import './review.css';import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app'),props:{data:window.reviewData,detail:window.reviewDetail}});window.reviewReady=true;`);
  await write('ssr.js',`import {render} from 'svelte/server';import App from './App.svelte';export const html=(data,detail)=>render(App,{props:{data,detail}}).body;`);
  await write('paths.js',"export const base='';");
  await write('navigation.js',"export const goto=async()=>{};export const invalidateAll=async()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('fixture-invalidate'));};");
  await write('public.js',"export const PUBLIC_WEBSITE_URL='http://website.fixture';");
  await write('session.js','export const sessionFetch=(...args)=>fetch(...args);');
  await write('enhance.js',`export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const handler=await callback({formElement:form,formData:new FormData(form),cancel(){cancelled=true;}});if(cancelled)return;const response=await fetch(form.action,{method:'POST',body:new FormData(form)});const result=await response.json();await handler?.({result,update:async()=>{}});};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`);
  server = httpServer(async(req,res)=>{
    if(req.url.startsWith('/viaturas/')){res.writeHead(200,{'content-type':'text/html'});res.end('<h1>Ficha de teste</h1>');return;}
    if(req.url==='/'||req.url.startsWith('/?')){
      try {const data=fixture(req.url),detail=req.url.includes('detail'),module=await vite.ssrLoadModule('/ssr.js');const html=await vite.transformIndexHtml('/',`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>window.reviewData=${JSON.stringify(data)};window.reviewDetail=${detail}</script><div id="app">${module.html(data,detail)}</div><script type="module" src="/client.js"></script></body></html>`);res.writeHead(200,{'content-type':'text/html'});res.end(html);}catch(e){res.writeHead(500);res.end(String(e));}return;
    }
    vite.middlewares(req,res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  vite = await createServer({configFile:false,root:directory,plugins:[tailwindcss(),svelte({configFile:false})],
    ssr:{noExternal:['lucide-svelte','svelte-sonner']},resolve:{alias:[
      {find:'$detail',replacement:path.join(appRoot,'src/routes/(app)/viaturas/[id]/+page.svelte')},
      {find:'$edit',replacement:path.join(appRoot,'src/routes/(app)/viaturas/[id]/editar/+page.svelte')},
      {find:'$lib/auth/session',replacement:path.join(directory,'session.js')},
      {find:'$lib/auth/enhance',replacement:path.join(directory,'enhance.js')},
      {find:'$app/navigation',replacement:path.join(directory,'navigation.js')},
      {find:'$app/paths',replacement:path.join(directory,'paths.js')},
      {find:'$env/static/public',replacement:path.join(directory,'public.js')},
      {find:'$lib',replacement:path.join(appRoot,'src/lib')},
    ]},server:{middlewareMode:true,hmr:{server,host:'127.0.0.1',clientPort:Number(new URL(origin).port)},fs:{allow:[path.resolve(appRoot,'../..'),await realpath(path.resolve(appRoot,'../../node_modules'))]}},optimizeDeps:{entries:['client.js']},logLevel:'error'});
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL||'chrome'});
});
after(async()=>{
  await browser?.close();await vite?.close();if(server)await new Promise(r=>server.close(r));
  if(directory&&path.dirname(directory)===path.join(appRoot,'.svelte-kit')&&path.basename(directory).startsWith('vehicle-edit-actions-'))await rm(directory,{recursive:true,force:true});
});

for(const width of [1366,390])for(const theme of ['light','dark'])test(`edit actions, publication and retention ${width}px ${theme}`,{timeout:120000},async()=>{
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),errors=[],posts=[];let saved=fixture(),failOnce=true;
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
    if(url.pathname.endsWith('/editar/save')){
      if(request.method()==='POST'){
        const value=request.postDataJSON();posts.push(value);
        if(failOnce){failOnce=false;return route.fulfill({status:422,json:{issues:[{path:['publication','price'],message:'Preço de teste inválido.'}]}});}
        saved.vehicle={...saved.vehicle,...value.data,year:Number(value.data.year),mileage:Number(value.data.mileage),photos:value.photos,updatedAt:new Date(Date.parse(saved.vehicle.updatedAt)+1000).toISOString()};
        if(value.publication)Object.assign(saved.vehicle,{webPublished:value.publication.published,publicSlug:'ficha-teste',publicPrice:value.publication.price,publicDescription:value.publication.description,publicTransmission:value.publication.transmission,publicSpecifications:value.publication.specifications});
        return route.fulfill({json:{ok:true}});
      }
      return route.fulfill({json:saved});
    }
    return route.continue();
  });
  const load=async(query='')=>{await page.goto(origin+'/'+query);await page.waitForFunction(()=>window.reviewReady);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.waitForTimeout(500);};
  const trigger=()=>page.locator('.publication-trigger'),save=()=>page.locator('.edit-save-top button.primary');
  const cancel=()=>page.getByRole('button',{name:'Cancelar e voltar',exact:true});
  const editor=()=>page.locator('.publication-editor');
  try{
    await load();assert.equal(await editor().getAttribute('open'),null);assert.equal(await save().isDisabled(),true);assert.equal(posts.length,0);assert.equal(await page.locator('.photo-card .visibility,.photo-card .live').count(),0);assert.ok((await page.locator('.draft-toolbar').innerText()).includes('Otimização para cerca de 1,1 MB'));
    const actions=await page.locator('.edit-actions button').allTextContents();assert.deepEqual(actions,['Publicar no website','Cancelar e voltar','Guardar alterações']);
    await page.locator('[name="model"]').fill('Rascunho mantido');await trigger().click();assert.equal(await trigger().getAttribute('aria-expanded'),'true');assert.equal(await page.locator('#web-publication-title').evaluate(n=>n===document.activeElement),true);
    await page.locator('.publish-toggle input').check();await page.locator('[name="publicPrice"]').fill('17500');
    await trigger().click();assert.equal(await editor().getAttribute('open'),null);assert.equal(await page.locator('[name="model"]').inputValue(),'Rascunho mantido');assert.equal(posts.length,0,'opening/closing never publishes');
    await save().click();await page.waitForFunction(()=>document.querySelector('[name="publicPrice"]')?.getAttribute('aria-invalid')==='true');assert.equal(await editor().getAttribute('open'),'');assert.equal(await trigger().getAttribute('aria-expanded'),'true');assert.equal(await page.locator('[name="publicPrice"]').inputValue(),'17500');assert.equal(await page.locator('[name="model"]').inputValue(),'Rascunho mantido');
    await page.locator('[name="publicPrice"]').fill('18000');await save().click();await page.waitForFunction(()=>document.querySelector('.publication-trigger')?.textContent==='Gerir publicação');assert.equal(posts.at(-1).publication.published,true);assert.equal(posts.at(-1).data.model,'Rascunho mantido');assert.deepEqual(posts.at(-1).photos,[photo]);await page.waitForFunction(()=>document.querySelector('.edit-save-top button.primary')?.disabled);
    await page.locator('.publish-toggle input').uncheck();await save().click();await page.waitForFunction(()=>document.querySelector('.publication-trigger')?.textContent==='Publicar no website');assert.equal(posts.at(-1).publication.published,false);
    await page.locator('[name="model"]').fill('Não descartar ainda');await cancel().click();await page.getByRole('button',{name:'Continuar a editar',exact:true}).click();assert.equal(await page.locator('[name="model"]').inputValue(),'Não descartar ainda');
    await page.locator('.edit-save-top').screenshot({path:path.join(appRoot,`.svelte-kit/vehicle-edit-toolbar-${width}-${theme}.png`)});await page.screenshot({path:path.join(appRoot,`.svelte-kit/vehicle-edit-actions-${width}-${theme}.png`),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal page overflow');assert.equal(await page.locator('form form').count(),0);
    await cancel().click();await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();await page.waitForURL('**/viaturas/'+id);
    // Existing eligibility and no-photo confirmation stay deliberate and retain the draft.
    await load('?blocked=1');const previous=posts.length;await trigger().click();await page.locator('.publish-toggle input').check();await save().click();await page.waitForFunction(()=>!!document.querySelector('[data-edit-issue-key="published"]'));assert.equal(posts.length,previous);
    await page.locator('.publish-toggle input').uncheck();await page.waitForFunction(()=>document.querySelector('.edit-save-top button.primary')?.disabled);await load('?empty=1');await trigger().click();await page.locator('.publish-toggle input').check();await save().click();await page.getByRole('button',{name:'Continuar a editar',exact:true}).click();assert.equal(await page.locator('.publish-toggle input').isChecked(),true);assert.equal(posts.length,previous);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

for(const width of [1366,390])for(const theme of ['light','dark'])test(`detail expenses beside photos and financial readability ${width}px ${theme}`,{timeout:90000},async()=>{
  const context=await browser.newContext({viewport:{width,height:950},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),errors=[],posts=[];let data=fixture(),failOnce=true;
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
    if(request.method()==='POST'){
      const raw=request.postData(),body=Object.fromEntries([...String(raw).matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)].map(m=>[m[1],m[2]]));posts.push({action:url.search,body});
      if(url.search.includes('addExpense')){
        if(failOnce){failOnce=false;return route.fulfill({json:{type:'failure',status:422,data:{error:'Erro de teste. Rascunho mantido.'}}});}
        data.vehicle.expenses.push({id:'expense-2',...body});
      }else if(url.search.includes('updateExpense'))Object.assign(data.vehicle.expenses.find(e=>e.id===body.expenseId),body);
      else if(url.search.includes('deleteExpense'))data.vehicle.expenses=data.vehicle.expenses.filter(e=>e.id!==body.expenseId);
      await page.evaluate(value=>window.reviewNextData=value,data);
      return route.fulfill({json:{type:'success',status:200,data:{}}});
    }
    return route.continue();
  });
  try{
    await page.goto(origin+'/?detail=1');await page.waitForFunction(()=>window.reviewReady);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.waitForTimeout(500);
    const expense=page.locator('.expense-layout'),gallery=page.locator('.photo-preview').locator('..').locator('..').locator('..');
    assert.equal(await expense.evaluate(n=>n.parentElement.classList.contains('vehicle-sidebar')&&n.previousElementSibling.textContent.includes('Documentos pendentes')),true);
    assert.equal(await expense.locator('h3').evaluate(n=>n.scrollWidth<=n.clientWidth),true,'expense heading is not truncated');assert.equal(await expense.locator('table').evaluate(n=>getComputedStyle(n).display),'block','narrow side column uses existing readable cards');
    assert.equal(await page.locator('.saved-visibility,.thumb-visibility').count(),0);
    assert.equal(await gallery.getByText('Foto principal',{exact:true}).count(),1);
    assert.ok(!/JPEG|Consulte as fotografias|No site/.test(await gallery.innerText()),'overview has no upload help or per-photo publication badges');
    const geo=await page.locator('.vehicle-sidebar').evaluate(n=>{const r=n.getBoundingClientRect(),p=document.querySelector('.profit-card').getBoundingClientRect();return {right:r.right,bottom:r.bottom,profitTop:p.top};});assert.ok(geo.profitTop>=geo.bottom-1,'margin stays below the top grid');
    await expense.getByRole('button',{name:'Adicionar',exact:true}).click();const add=expense.locator('form[action="?/addExpense"]');
    await add.locator('[name="description"]').fill('Limpeza e preparação confirmada');await add.locator('[name="amount"]').fill('89.90');await add.locator('[name="category"]').selectOption('CLEANING');
    await add.getByRole('button',{name:'Adicionar',exact:true}).click();await page.waitForFunction(()=>document.querySelector('form[action="?/addExpense"] button[type=submit]')?.disabled===false);assert.equal(await add.locator('[name="description"]').inputValue(),'Limpeza e preparação confirmada');
    await add.getByRole('button',{name:'Adicionar',exact:true}).click();await expense.getByRole('button',{name:'Editar despesa: Limpeza e preparação confirmada',exact:true}).waitFor();
    assert.equal(posts.length,2);await expense.getByRole('button',{name:'Editar despesa: Limpeza e preparação confirmada',exact:true}).click();
    const edit=expense.locator('form[action="?/updateExpense"]');await edit.locator('[name="description"]').fill('Preparação revista');await edit.locator('[name="amount"]').fill('100.25');await edit.getByRole('button',{name:'Guardar',exact:true}).click();await expense.getByRole('button',{name:'Editar despesa: Preparação revista',exact:true}).waitFor();
    page.once('dialog',dialog=>dialog.accept());await expense.getByRole('button',{name:'Eliminar despesa: Preparação revista',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.expense-table tbody tr').length===1);
    assert.equal(posts.at(-1).body.expenseId,'expense-2');assert.equal(posts.at(-1).action,'?/deleteExpense');
    // Long currency amounts and negative profit keep the shared numeric font and formatter.
    data.vehicle.purchasePrice='9876543210.12';data.vehicle.figures.realProfit='-1234567.89';
    await page.evaluate(value=>{window.reviewNextData=value;window.dispatchEvent(new Event('fixture-invalidate'));},data);await page.waitForTimeout(150);
    const profit=page.locator('.profit-card');assert.ok((await profit.innerText()).includes(new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(-1234567.89)));
    const families=await page.evaluate(()=>[getComputedStyle(document.querySelector('.profit-card .num-value')).fontFamily,getComputedStyle(document.querySelector('.expense-table .num-value')).fontFamily]);assert.equal(families[0],families[1]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await expense.evaluate(n=>n.scrollWidth>n.clientWidth),false);
    await profit.screenshot({path:path.join(appRoot,`.svelte-kit/profit-card-${width}-${theme}.png`)});await expense.screenshot({path:path.join(appRoot,`.svelte-kit/detail-expenses-${width}-${theme}.png`)});
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
