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
    publicSlug:query.includes('detail')?'vehicle-aaaaaaaaaaaa':null, publicPrice:null, publicDescription:'Descrição pública confirmada.', publicTransmission:null,
    publicSpecifications:null,expenses:[{id:'expense-1',category:'REPAIR',description:'Reparação confirmada',amount:'120.00',date:'2026-10-20'}],expensesTotal:'120.00',figures:{margin:'9000.00',vatAmount:'1682.93',commission:'0.00',realProfit:'7197.07'} }, isFeatured:false,signedPhotos:empty?[]:[{path:photo,url:image}] };
}
const fixtureStates=new Map();
let directory, vite, server, browser, origin;
before(async () => {
  await mkdir(path.join(appRoot,'.svelte-kit'),{recursive:true});
  directory = await mkdtemp(path.join(appRoot,'.svelte-kit/vehicle-edit-actions-'));
  const write = (name,value) => writeFile(path.join(directory,name),value);
  await write('package.json','{"type":"module"}');
  await write('review.css',"@import '../../src/app.css';\n@source '../../src';");
  await write('App.svelte',`<script>import {onMount} from 'svelte';import EditPage from '$edit';import DetailPage from '$detail';import HomepageHighlightsEditor from '$lib/components/vehicle/HomepageHighlightsEditor.svelte';import VehicleTable from '$lib/components/vehicle/VehicleTable.svelte';import {Toaster} from 'svelte-sonner';let {data,detail=false,mode=""}=$props();let returned=$state(false);onMount(()=>{const navigate=()=>returned=true;window.addEventListener("fixture-navigate",navigate);return()=>window.removeEventListener("fixture-navigate",navigate);});onMount(()=>{const refresh=()=>{if(window.reviewNextData)data=structuredClone(window.reviewNextData);};window.addEventListener('fixture-invalidate',refresh);return()=>window.removeEventListener('fixture-invalidate',refresh);});</script><main style="max-width:1280px;margin:auto;padding:96px 20px 40px">{#if returned}<h1>Destino confirmado</h1><p>{window.reviewSavedModel}</p>{:else if mode === "highlights"}<HomepageHighlightsEditor editor={data.editor} selectedVehicleId={data.selectedVehicleId}/>{:else if mode === "list"}<VehicleTable items={data.items}/>{:else if detail}<DetailPage {data}/>{:else}<EditPage {data}/>{/if}</main><Toaster/>`);
  await write('client.js',`import './review.css';import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app'),props:{data:window.reviewData,detail:window.reviewDetail,mode:window.reviewMode}});window.reviewReady=true;`);
  await write('ssr.js',`import {render} from 'svelte/server';import App from './App.svelte';export const html=(data,detail,mode)=>render(App,{props:{data,detail,mode}}).body;`);
  await write('paths.js',"export const base='';");
  await write('navigation.js',"import {hasUnsavedForms} from '$lib/forms/formFeedback';export const afterNavigate=(callback)=>{if(typeof window!=='undefined')queueMicrotask(()=>callback({from:window.reviewFrom?{url:new URL(window.reviewFrom,location.origin)}:null,to:{url:new URL(location.href)}}));};export const goto=async(href,options)=>{window.reviewNavigation={href,options,dirty:hasUnsavedForms()};if(window.reviewSimulateNavigation){history.pushState({},'',href);window.dispatchEvent(new Event('fixture-navigate'));}};export const invalidateAll=async()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('fixture-invalidate'));};");
  await write('public.js',"export const PUBLIC_WEBSITE_URL='http://website.fixture';");
  await write('session.js','export const sessionFetch=(...args)=>fetch(...args);');
  await write('enhance.js',`export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const handler=await callback({formElement:form,formData:new FormData(form),cancel(){cancelled=true;}});if(cancelled)return;const response=await fetch(form.action,{method:'POST',body:new FormData(form)});const result=await response.json();await handler?.({result,update:async()=>{window.dispatchEvent(new Event('fixture-invalidate'));}});};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`);
  server = httpServer(async(req,res)=>{
    if(req.url.startsWith('/viaturas/')){res.writeHead(200,{'content-type':'text/html'});res.end('<h1>Ficha de teste</h1>');return;}
    if(req.url==='/'||req.url.startsWith('/?')||req.url.startsWith('/site/destaques')){
      try {const mode=req.url.includes('/site/destaques')?'highlights':req.url.includes('list=1')?'list':'',data=fixtureStates.get(req.headers['x-review-case'])??fixture(req.url),detail=req.url.includes('detail'),module=await vite.ssrLoadModule('/ssr.js');const html=await vite.transformIndexHtml('/',`<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>window.reviewData=${JSON.stringify(data)};window.reviewDetail=${detail};window.reviewMode=${JSON.stringify(mode)}</script><div id="app">${module.html(data,detail,mode)}</div><script type="module" src="/client.js"></script></body></html>`);res.writeHead(200,{'content-type':'text/html'});res.end(html);}catch(e){res.writeHead(500);res.end(String(e));}return;
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
    ]},server:{middlewareMode:true,hmr:{server,host:'127.0.0.1',clientPort:Number(new URL(origin).port)},fs:{allow:[path.resolve(appRoot,'../..'),await realpath(path.resolve(appRoot,'../../node_modules'))]}},optimizeDeps:{entries:['client.js'],include:['heic-to/next']},logLevel:'error'});
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL||'chrome'});
});
after(async()=>{
  await browser?.close();await vite?.close();if(server)await new Promise(r=>server.close(r));
  if(directory&&path.dirname(directory)===path.join(appRoot,'.svelte-kit')&&path.basename(directory).startsWith('vehicle-edit-actions-'))await rm(directory,{recursive:true,force:true});
});

for (const width of [1366,390]) test(`confirmed save returns safely with visible feedback ${width}px`, {timeout:120000}, async()=>{
  for (const from of [`/viaturas/${id}`, '/viaturas?q=BMW&page=3&status=AVAILABLE', null, 'https://external.test/viaturas', `/viaturas/${id}/editar?/submit`]) {
    const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage();
    let saved=fixture(),posts=0;
    await page.addInitScript(value=>{window.reviewFrom=value;window.reviewSimulateNavigation=true;},from);
    await page.route('**/editar/save',async route=>{
      if(route.request().method()==='POST') {const body=route.request().postDataJSON();posts++;saved.vehicle={...saved.vehicle,...body.data,year:Number(body.data.year),mileage:Number(body.data.mileage),updatedAt:'2026-10-28T00:00:01.000Z'};await page.evaluate(model=>window.reviewSavedModel=model,saved.vehicle.model);return route.fulfill({json:{ok:true}});}
      return route.fulfill({json:saved});
    });
    try {
      await page.goto(origin);await page.waitForFunction(()=>window.reviewReady);await page.locator('[name=model]').fill('Modelo guardado');
      await page.locator(width===390?'.edit-save:not(.edit-save-top) button.primary':'.edit-save-top button.primary').click();
      await page.getByRole('heading',{name:'Destino confirmado'}).waitFor();
      const navigation=await page.evaluate(()=>window.reviewNavigation);
      assert.equal(navigation.href,from?.startsWith('/viaturas?')?from:`/viaturas/${id}`);
      assert.equal(navigation.dirty,false,'unsaved guard is cleared before returning');assert.equal(navigation.options.invalidateAll,true);assert.equal(posts,1);
      await page.getByText('Modelo guardado',{exact:true}).waitFor();await page.locator('[data-sonner-toast]').filter({hasText:'Alterações guardadas'}).waitFor();
    } finally {await context.close();}
  }
});

test('failed or unconfirmed saves retain edits and never return', {timeout:120000}, async()=>{
  for (const failure of ['validation','atomic','unknown','confirmation','upload']) {
    const context=await browser.newContext(),page=await context.newPage();let posted=false;
    await page.addInitScript(()=>window.reviewFrom='/viaturas?q=BMW&page=2');
    await page.route('**/editar/save',async route=>{
      if(route.request().method()==='POST') {posted=true;if(failure==='validation'||failure==='atomic')return route.fulfill({status:422,json:{issues:[{path:['data','model'],message:'Falha de teste. Rascunho mantido.'}]}});if(failure==='unknown')return route.abort();return route.fulfill({json:{ok:true}});}
      if(posted&&failure==='confirmation')return route.fulfill({status:503,json:{error:'Indisponível'}});
      return route.fulfill({json:fixture()});
    });
    await page.route('**/photos',route=>route.fulfill({status:422,json:{error:'Falha de upload de teste'}}));
    try {
      await page.goto(origin);await page.waitForFunction(()=>window.reviewReady);await page.locator('[name=model]').fill('Rascunho protegido');
      if(failure==='upload') {await page.locator('input[type=file]').first().setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64')});}
      if(failure==='atomic') {await page.locator('.publication-action').click();} else await page.locator('.edit-save-top button.primary').click();
      await page.locator('[data-sonner-toast]').filter({hasText:/mantido|confirmar|guardadas|upload/}).waitFor();
      assert.equal(await page.evaluate(()=>window.reviewNavigation),undefined);assert.equal(await page.locator('[name=model]').inputValue(),'Rascunho protegido');
      assert.equal(await page.locator('.vehicle-edit-page').isVisible(),true);
      if(failure==='validation'||failure==='atomic')await page.locator('.edit-errors').waitFor();
    } finally {await context.close();}
  }
});

for(const width of [1366,390])for(const theme of ['light','dark'])test(`direct publication persisted on reload ${width}px ${theme}`,{timeout:120000},async()=>{
  const key=`publish-${width}-${theme}`,context=await browser.newContext({viewport:{width,height:950},extraHTTPHeaders:{'x-review-case':key},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),posts=[],errors=[];let saved=fixture(),failOnce=true;
  fixtureStates.set(key,saved);page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
    if(url.pathname.endsWith('/editar/save')){
      if(request.method()==='POST'){
        const value=request.postDataJSON();posts.push(value);
        if(failOnce){failOnce=false;return route.fulfill({status:422,json:{issues:[{path:['publication','price'],message:'Preço de teste inválido.'}]}});}
        saved.vehicle={...saved.vehicle,...value.data,year:Number(value.data.year),mileage:Number(value.data.mileage),photos:value.photos,updatedAt:new Date(Date.parse(saved.vehicle.updatedAt)+1000).toISOString()};
        if(value.publication)Object.assign(saved.vehicle,{webPublished:value.publication.published,publicSlug:'vehicle-aaaaaaaaaaaa',publicPrice:value.publication.price,publicDescription:value.publication.description,publicTransmission:value.publication.transmission,publicSpecifications:value.publication.specifications});
        fixtureStates.set(key,structuredClone(saved));return route.fulfill({json:{ok:true}});
      }
      return route.fulfill({json:saved});
    }
    return route.continue();
  });
  const load=async()=>{await page.goto(origin);await page.waitForFunction(()=>window.reviewReady);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.waitForTimeout(450);};
  const action=()=>page.locator('.publication-action'),save=()=>page.locator('.edit-save-top button.primary');
  try{
    await load();assert.equal(await page.locator('.publication-editor').isVisible(),true);assert.equal(await page.locator('.publish-toggle,input[type=checkbox][data-error-field=published],.publication-trigger').count(),0);assert.ok(!(await page.locator('.vehicle-edit-page').innerText()).includes('Todas as fotografias acompanham'));
    const status=page.locator('.edit-save-top .website-status');assert.match(await status.innerText(),/Não publicado/);assert.ok((await status.boundingBox()).y<950,'publication status is visible without scrolling');
    assert.equal(await save().isDisabled(),true);assert.equal(await action().isDisabled(),false);await action().click();await page.waitForFunction(()=>!!document.querySelector('[name="publicPrice"][aria-invalid=true]'));assert.equal(posts.length,1);assert.match(await status.innerText(),/Não publicado/);
    await page.locator('[name="model"]').fill('Rascunho mantido');await page.locator('[name="publicPrice"]').fill('18000');assert.match(await action().innerText(),/Guardar e publicar/);await action().click();await page.waitForFunction(()=>document.querySelector('.edit-save-top .website-status')?.textContent.includes('Publicado'));
    assert.equal(posts.length,2);assert.equal(posts.at(-1).publication.published,true);assert.equal(posts.at(-1).data.model,'Rascunho mantido');assert.deepEqual(posts.at(-1).photos,[photo]);await page.waitForFunction(()=>!document.querySelector('.publication-action')?.disabled&&document.querySelector('.edit-save-top button.primary')?.disabled);
    await load();assert.match(await status.innerText(),/Publicado/);assert.equal(await action().innerText(),'Retirar do website');assert.equal(await page.locator('[name="model"]').inputValue(),'Rascunho mantido');
    await page.locator('[name="model"]').fill('Alteração e retirada');await action().click();await page.waitForFunction(()=>document.querySelector('.publication-action')?.textContent==='Publicar no website');assert.equal(posts.at(-1).publication.published,false);assert.equal(posts.at(-1).data.model,'Alteração e retirada');await page.waitForFunction(()=>!document.querySelector('.publication-action')?.disabled&&document.querySelector('.edit-save-top button.primary')?.disabled);
    await load();assert.match(await status.innerText(),/Não publicado/);assert.equal(await page.locator('[name="model"]').inputValue(),'Alteração e retirada');
    // Publish without a dirty form must also perform one real save request.
    const before=posts.length;await action().click();await page.waitForFunction(()=>document.querySelector('.publication-action')?.textContent==='Retirar do website');assert.equal(posts.length,before+1);assert.equal(posts.at(-1).publication.published,true);await page.waitForFunction(()=>!document.querySelector('.publication-action')?.disabled&&document.querySelector('.edit-save-top button.primary')?.disabled);
    await load();await page.locator('.edit-save-top').screenshot({path:path.join(appRoot,`.svelte-kit/direct-publication-${width}-${theme}.png`)});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.locator('form form').count(),0);
    await page.locator('[name="model"]').fill('Manter edição');await page.getByRole('button',{name:'Cancelar e voltar',exact:true}).click();await page.getByRole('button',{name:'Continuar a editar',exact:true}).click();assert.equal(await page.locator('[name="model"]').inputValue(),'Manter edição');await page.getByRole('button',{name:'Cancelar e voltar',exact:true}).click();await page.getByRole('button',{name:'Descartar alterações',exact:true}).click();await page.waitForURL('**/viaturas/'+id);
    saved=fixture('?blocked=1');fixtureStates.set(key,saved);await load();const blockedPosts=posts.length;await action().click();await page.waitForFunction(()=>!!document.querySelector('[data-edit-issue-key=published]'));assert.equal(posts.length,blockedPosts);assert.match(await status.innerText(),/Não publicado/);
    saved=fixture('?empty=1');fixtureStates.set(key,saved);await load();await action().click();await page.getByRole('button',{name:'Continuar a editar',exact:true}).click();assert.equal(posts.length,blockedPosts);assert.equal(await page.locator('[name=published]').inputValue(),'false');
    await action().click();await page.getByRole('button',{name:'Confirmar e guardar alterações',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.edit-save-top .website-status')?.textContent.includes('sem fotografias'));assert.equal(posts.at(-1).publication.published,true);assert.deepEqual(posts.at(-1).photos,[]);
    assert.deepEqual(errors,[]);
  }finally{fixtureStates.delete(key);await context.close();}
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
    const links=page.locator('.vehicle-actions a');assert.equal((await links.last().textContent()).trim(),'Vender viatura');assert.ok((await links.last().getAttribute('href')).endsWith('/vender'));assert.ok((await page.getByRole('link',{name:'Destacar viatura',exact:true}).getAttribute('href')).includes('viatura='+id));assert.equal(await expense.evaluate(n=>n.parentElement.classList.contains('vehicle-sidebar')&&(/Documentos pendentes|Sem pendências documentais/.test(n.previousElementSibling.textContent))),true);
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

for(const width of [1366,390])for(const theme of ['light','dark'])test(`website indicators and contextual highlight persistence ${width}px ${theme}`,{timeout:90000},async()=>{
  const key=`highlights-${width}-${theme}`,context=await browser.newContext({viewport:{width,height:950},extraHTTPHeaders:{'x-review-case':key}}),page=await context.newPage(),errors=[],posts=[];
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  const base=fixture('?detail=1').vehicle;
  const variants=[base,{...base,id:id+'a',webPublished:false},{...base,id:id+'b',status:'SOLD',sale:{id:'sale'}},{...base,id:id+'c',photos:[]},{...base,id:id+'d',status:'DRAFT'},{...base,id:id+'e',publicSlug:null}];
  fixtureStates.set(key,{items:variants});
  let data={selectedVehicleId:id,editor:{revision:'version-1',items:[{vehicleId:'other',photoPath:'other-photo'}],candidates:[{id,brand:'BMW',model:'One',year:2020,slug:'vehicle-aaaaaaaaaaaa',photos:[{path:photo,url:image},{path:photo.replace('000000000002.webp','000000000003.webp'),url:image}]},{id:'other',brand:'Outra',model:'Viatura',year:2021,slug:'other',photos:[{path:'other-photo',url:image}]}]}};
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.origin!==origin)return route.abort();
    if(request.method()==='POST'){
      const raw=request.postData(),match=String(raw).match(/name="selection"\r\n\r\n([^\r]*)/);const selection=JSON.parse(match[1]);posts.push(selection);
      if(posts.length===1)return route.fulfill({json:{type:'failure',status:409,data:{error:'Falha de teste. Seleção mantida.'}}});
      data={...data,editor:{...data.editor,revision:'version-'+posts.length,items:selection.items}};fixtureStates.set(key,data);await page.evaluate(value=>window.reviewNextData=value,data);
      return route.fulfill({json:{type:'success',status:200,data:{saved:true}}});
    }
    return route.continue();
  });
  try{
    await page.goto(origin+'/?list=1');await page.waitForFunction(()=>window.reviewReady);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.waitForTimeout(350);
    const visible=page.locator('.website-status:visible');assert.equal(await visible.count(),2);assert.equal(await visible.filter({hasText:'No website'}).count(),2);assert.equal(await visible.filter({hasText:'Site oculto'}).count(),0);assert.equal(await visible.filter({hasText:'Só CRM'}).count(),0);
    assert.ok(await visible.first().getAttribute('aria-label'));assert.equal(await visible.first().locator('svg').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(appRoot,`.svelte-kit/website-list-${width}-${theme}.png`)});
    fixtureStates.set(key,data);const url=origin+'/site/destaques?viatura='+id;await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('.selected-list li').length===2);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.equal(posts.length,0,'preselection never saves on render');assert.equal(await page.locator('.photo-picker button').count(),2);await page.getByRole('button',{name:'Fotografia 2',exact:true}).click();
    const save=page.getByRole('button',{name:'Guardar destaques',exact:true});await save.click();await page.getByRole('alert').filter({hasText:'Falha de teste'}).waitFor();assert.equal(await page.getByRole('button',{name:'Fotografia 2',exact:true}).getAttribute('aria-pressed'),'true');
    await save.click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar destaques')?.disabled);assert.equal(posts.at(-1).items[0].vehicleId,'other');assert.equal(posts.at(-1).items.filter(i=>i.vehicleId===id).length,1);assert.equal(posts.at(-1).items[1].photoPath,data.editor.candidates[0].photos[1].path);
    await page.reload();await page.waitForFunction(()=>document.querySelectorAll('.photo-picker button').length===2);assert.equal(await page.getByRole('button',{name:'Fotografia 2',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.selected-list li').count(),2);assert.equal(posts.length,2,'reload does not duplicate or save implicitly');await page.getByRole('button',{name:'Remover destaque 2',exact:true}).click();await save.click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar destaques')?.disabled);assert.equal(posts.at(-1).items.some(item=>item.vehicleId===id),false);fixtureStates.set(key,{...fixture('?detail=1'),homepageHighlight:'none',isFeatured:false});await page.goto(origin+'/?detail=1');await page.getByRole('link',{name:'Destacar viatura',exact:true}).waitFor();await page.reload();await page.getByRole('link',{name:'Destacar viatura',exact:true}).waitFor();assert.equal(await page.getByText('Em destaque',{exact:true}).count(),0);
    await page.screenshot({path:path.join(appRoot,`.svelte-kit/contextual-highlight-${width}-${theme}.png`)});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  }finally{fixtureStates.delete(key);await context.close();}
});


test('save waits for local preparation, preserves appended queue and reuses staged uploads on retry', {timeout:90000},async()=>{
  const context=await browser.newContext(),page=await context.newPage();
  let saved=fixture(),uploads=0,saves=0,failOnce=true,workers=0,release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/*photoPreparation.worker*',async route=>{if(new URL(route.request().url()).searchParams.has('worker_file')){workers++;await gate;}return route.continue();});
  await page.route('**/photos',async route=>{uploads++;assert.equal(route.request().headers()['x-edit-stage'],'true');assert.ok(route.request().headers()['x-upload-id']);return route.fulfill({json:{path:id+'/new-'+uploads+'.jpg'}});});
  await page.route('**/editar/save',async route=>{
    if(route.request().method()==='POST'){
      saves++;const body=route.request().postDataJSON();
      if(failOnce){failOnce=false;return route.fulfill({status:422,json:{error:'Falha de teste. Rascunho mantido.'}});}
      saved.vehicle={...saved.vehicle,...body.data,photos:body.photos,updatedAt:'2026-10-28T00:00:01.000Z'};
      return route.fulfill({json:{ok:true}});
    }
    return route.fulfill({json:saved});
  });
  try{
    await page.goto(origin);await page.waitForFunction(()=>window.reviewReady);
    const jpeg=await (await import('node:fs/promises')).readFile(path.resolve(appRoot,'../website/static/images/about/auto-nunes-martins-fachada-v2-1024.jpg'));
    const input=page.locator('input[type=file]').first();
    await input.setInputFiles([{name:'one.jpg',mimeType:'image/jpeg',buffer:jpeg},{name:'two.jpg',mimeType:'image/jpeg',buffer:jpeg}]);
    await input.setInputFiles({name:'three.jpg',mimeType:'image/jpeg',buffer:jpeg});
    await page.locator('[name=model]').fill('Continuo a preencher durante preparação');
    assert.equal(uploads,0);assert.equal(saves,0);
    await page.locator('.edit-save-top button.primary').click();
    await page.locator('[data-save-progress]').getByText('A preparar fotografias: 0 de 3…',{exact:true}).waitFor();
    assert.equal(uploads,0);assert.equal(saves,0);
    const progressBox=await page.locator('[data-save-progress]').boundingBox(),toolbarBox=await page.locator('#vehicle-edit-actions').boundingBox();assert.ok(progressBox.y>=toolbarBox.y+toolbarBox.height,'sticky toolbar does not cover save progress');
    await page.locator('[data-save-progress]').screenshot({path:path.join(appRoot,'.svelte-kit','photo-save-waiting.png')});
    release();
    await page.locator('[data-sonner-toast]').filter({hasText:'Falha de teste'}).waitFor();
    assert.equal(uploads,3);assert.equal(saves,1);assert.equal(workers,3);
    await page.locator('.edit-save-top button.primary').click();
    await page.locator('[data-sonner-toast]').filter({hasText:'Alterações guardadas'}).waitFor();
    assert.equal(uploads,3);assert.equal(saves,2);assert.equal(workers,3);
    assert.equal(saved.vehicle.photos.length,4);
  }finally{release();await context.close();}
});
