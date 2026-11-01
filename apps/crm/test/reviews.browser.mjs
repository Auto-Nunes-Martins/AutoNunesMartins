// Actual editor/public cards. API fixtures are local memory only; never real reviews or credentials.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer as httpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';
import sharp from 'sharp';

const crm = fileURLToPath(new URL('../', import.meta.url)), project = path.resolve(crm,'../..');
const website = path.join(project,'apps/website');
let server,vite,browser,origin,items=[],nextId=0,failSave=false,failPhoto=false,avatar;
const images=new Map();
const original=readFileSync(new URL('./fixtures/OrbitReviews.original.svelte.txt',import.meta.url),'utf8');
const originalExamples=new Function('return '+original.match(/const examples = (\[[\s\S]*?\n  \]);/)[1])();
const equivalent=originalExamples.map((r,i)=>({id:'reference-'+i,authorName:r.name,rating:r.rating,text:r.text,avatarVersion:null}));
before(async()=>{
  await mkdir(path.join(crm,'.svelte-kit'),{recursive:true});
  const directory=await mkdtemp(path.join(crm,'.svelte-kit/reviews-review-'));
  const write=(name,text)=>writeFile(path.join(directory,name),text);
  await write('package.json','{"type":"module"}');
  await write('paths.js',"export const base='/crm';");
  await write('session.js','export const sessionFetch=(...args)=>fetch(...args);');
  await write('stores.js',`import{writable}from'svelte/store';export const page=writable({url:new URL(window.location.pathname==='/crm'?window.location.origin+'/crm/site/reviews':window.location.href)});`);
  await write('enhance.js',`export function enhance(){return{destroy(){}}}`);
  await write('Crm.svelte',`<script>import Editor from '$editor';import Layout from '$siteLayout';import Highlights from '$highlights';const editor={revision:null,items:[],candidates:Array.from({length:40},(_,i)=>({id:'car-'+i,brand:'Marca',model:'Modelo '+(i+1),year:2020,slug:'car-'+i,photos:[{path:'vehicles/car-'+i+'/photo.webp',url:null}]}))};</script><main style="max-width:1100px;margin:auto;padding:32px 20px"><Layout>{#if window.location.pathname.endsWith('/destaques')}<Highlights {editor}/>{:else}<Editor initialItems={window.reviewData}/>{/if}</Layout></main>`);
  const publicStyle='--bg:#0c0c0e;--text:#f5f5f1;--muted:#96969d;--line:#ffffff24;--orbit-frame:calc(100% - 40px);--orbit-frame-max:1320px;--orbit-space-section:40px;';
  await write('Public.svelte',`<script>import Reviews from '$publicReviews';import Baseline from './Baseline.svelte';</script><main class="design orbit" style="${publicStyle}">{#if window.isBaseline}<Baseline/>{:else}<Reviews reviews={window.reviewData}/>{/if}</main>`);
  await write('Baseline.svelte',original.replace(/from '(\.\/[^']+)'/g,(_match,rel)=>'from '+JSON.stringify(path.resolve(website,'src/lib/components/stand-concepts',rel))));
  await write('crm.css',`@import ${JSON.stringify(path.join(crm,'src/app.css'))};\n@source ${JSON.stringify(path.join(crm,'src'))};`);
  await write('public.css',`@import ${JSON.stringify(path.join(website,'src/app.css'))};\n@source ${JSON.stringify(path.join(website,'src'))};`);
  for(const name of ['Crm','Public'])await write(name+'.js',`import './${name==='Crm'?'crm':'public'}.css';import {mount} from 'svelte';import App from './${name}.svelte';document.documentElement.dataset.theme='dark';mount(App,{target:document.querySelector('#app')});`);
  avatar=await sharp({create:{width:16,height:16,channels:3,background:'blue'}}).png().toBuffer();
  server=httpServer(async(req,res)=>{
    const url=new URL(req.url,'http://fixture');
    const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
    if(url.pathname.startsWith('/api/public/reviews/')){res.writeHead(200,{'content-type':'image/webp'});res.end(images.get(url.pathname.split('/')[4])??avatar);return;}
    if(url.pathname.startsWith('/crm/site/reviews/api')){
      const suffix=url.pathname.slice('/crm/site/reviews/api'.length),id=suffix.split('/')[1],photo=suffix.endsWith('/avatar');
      const buffers=[];for await(const chunk of req)buffers.push(chunk);const body=Buffer.concat(buffers);
      if(failSave&&!photo){failSave=false;reply(503,{error:'Falha de teste. Tente novamente.'});return;}
      if(photo){
        if(failPhoto){failPhoto=false;reply(503,{error:'Falha de teste na fotografia.'});return;}
        const row=items.find(x=>x.id===id);
        if(req.method==='DELETE'){row.avatarVersion=null;images.delete(id);}
        else {const bytes=await sharp(body).resize(128,128).webp().toBuffer();images.set(id,bytes);row.avatarVersion=createHash('sha256').update(bytes).digest('hex');}
        reply(200,row);return;
      }
      if(req.method==='POST'){const row={...JSON.parse(body),id:'fixture-'+(++nextId),avatarVersion:null};items.unshift(row);reply(201,row);return;}
      if(req.method==='PUT'){const row=items.find(x=>x.id===id);Object.assign(row,JSON.parse(body));reply(200,row);return;}
      if(req.method==='DELETE'){items=items.filter(x=>x.id!==id);images.delete(id);res.writeHead(204);res.end();return;}
      reply(200,{items});return;
    }
    if(url.pathname==='/crm/site'){
      const {load}=await vite.ssrLoadModule(path.join(crm,'src/routes/(app)/site/+page.server.ts'));
      try{load();res.writeHead(500);res.end('Expected redirect');}catch(redirect){res.writeHead(redirect.status,{location:redirect.location});res.end();}return;
    }
    if(['/crm','/crm/site/destaques','/crm/site/reviews','/public','/baseline'].includes(url.pathname)){
      const name=url.pathname.startsWith('/crm')?'Crm':'Public';
      const html=await vite.transformIndexHtml('/',`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>window.reviewData=${JSON.stringify(items).replaceAll('<','\\u003c')};window.isBaseline=${url.pathname==='/baseline'};</script><div id="app"></div><script type="module" src="/${name}.js"></script></body></html>`);
      res.writeHead(200,{'content-type':'text/html'});res.end(html);return;
    }
    vite.middlewares(req,res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  await write('public-env.js',`export const PUBLIC_BACKEND_URL=${JSON.stringify(origin)};`);
  vite=await createServer({configFile:false,root:directory,plugins:[tailwindcss(),svelte({configFile:false})],resolve:{alias:[
    {find:'$editor',replacement:path.join(crm,'src/lib/components/site/ReviewsEditor.svelte')},
    {find:'$siteLayout',replacement:path.join(crm,'src/routes/(app)/site/+layout.svelte')},
    {find:'$highlights',replacement:path.join(crm,'src/lib/components/vehicle/HomepageHighlightsEditor.svelte')},
    {find:'$lib/auth/enhance',replacement:path.join(directory,'enhance.js')},
    {find:'$app/stores',replacement:path.join(directory,'stores.js')},
    {find:'$publicReviews',replacement:path.join(website,'src/lib/components/stand-concepts/OrbitReviews.svelte')},
    {find:'$lib/auth/session',replacement:path.join(directory,'session.js')},
    {find:'$lib/brandMarquee',replacement:path.join(website,'src/lib/brandMarquee.ts')},
    {find:'$app/paths',replacement:path.join(directory,'paths.js')},
    {find:'$env/static/public',replacement:path.join(directory,'public-env.js')},
    {find:'$lib',replacement:path.join(crm,'src/lib')},
  ]},server:{middlewareMode:true,hmr:false,fs:{allow:[project]}},optimizeDeps:{entries:['Crm.js','Public.js']},logLevel:'error'});
  browser=await chromium.launch({headless:true,channel:'chrome'});
});
after(async()=>{await browser?.close();await vite?.close();if(server)await new Promise(r=>server.close(r));/* Preserve fixtures: no automatic directory cleanup. */});

async function assertStableCardFocus(page){
  await page.evaluate(()=>document.fonts.ready);
  const bounds=()=>page.locator('.edit-card,.edit-card .card-top,.edit-card input[data-inline-edit],.edit-card textarea,.card-bottom,.editor-help,.editor-actions').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return [r.left+scrollX,r.top+scrollY,r.width,r.height];}));
  const same=(actual,expected)=>actual.forEach((rect,i)=>rect.forEach((value,j)=>assert.ok(Math.abs(value-expected[i][j])<=.25,`focus changed card/field/sibling ${i} dimension ${j}: ${expected[i][j]} -> ${value}`)));
  for(const label of ['Nome público do autor','Texto da review']){
    const field=page.getByLabel(label);await field.blur();const before=await bounds();
    await field.click();same(await bounds(),before);
    await field.blur();same(await bounds(),before);
    await field.focus();same(await bounds(),before);
    await page.keyboard.press('Tab');same(await bounds(),before);
  }
}

async function assertBoundedTextResize(page){
  const field=page.getByLabel('Texto da review'),original=await field.inputValue();
  await field.fill(Array.from({length:80},(_,i)=>`Linha ${i+1}: texto integral da opinião continua acessível.`).join('\n'));
  await field.evaluate(el=>el.scrollIntoView({block:'center'}));const before=await field.boundingBox();
  const limits=await field.evaluate(el=>({min:parseFloat(getComputedStyle(el).minHeight),max:parseFloat(getComputedStyle(el).maxHeight)}));
  await page.mouse.move(before.x+before.width-3,before.y+before.height-3);await page.mouse.down();await page.mouse.move(before.x+before.width-3,before.y+before.height+350,{steps:8});await page.mouse.up();
  // Chrome's mobile emulation omits the native resize grip; exercise the same CSS
  // clamp there. Desktop above uses the real mouse drag.
  if(page.viewportSize().width<700&&(await field.boundingBox()).height<limits.max-1)await field.evaluate(el=>el.style.height='1000px');
  const expanded=await field.boundingBox();assert.ok(expanded.height<=limits.max+1);assert.ok(expanded.height>=limits.max-1);assert.equal(expanded.width,before.width);
  assert.ok(await field.evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop>0&&el.scrollTop+el.clientHeight>=el.scrollHeight-2;}));
  await page.mouse.move(expanded.x+expanded.width-3,expanded.y+expanded.height-3);await page.mouse.down();await page.mouse.move(expanded.x+expanded.width-3,expanded.y-100,{steps:8});await page.mouse.up();
  if(page.viewportSize().width<700)await field.evaluate(el=>el.style.height='1px');
  assert.ok((await field.boundingBox()).height>=limits.min-1);assert.ok((await field.boundingBox()).height<=before.height+1);
  await field.fill(original);await field.evaluate(el=>el.style.removeProperty('height'));await assertStableCardFocus(page);
}

for(const width of [1440,390])test(`manual review authoring, photo, initials, errors and public empty state at ${width}px`,async()=>{
  items=[];images.clear();nextId=0;
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',hasTouch:width===390,isMobile:width===390});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(origin+'/public');await page.waitForLoadState('networkidle');assert.equal(await page.locator('.reviews').count(),0);
    await page.goto(origin+'/crm');await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'Adicionar review',exact:true}).first().click();
    await expect(page.locator('.star-sparks')).toHaveCount(0);await page.emulateMedia({reducedMotion:'reduce'});
    await assertStableCardFocus(page);
    await page.getByLabel('Nome público do autor').fill('Maria Silva');await expect(page.locator('.edit-card .avatar')).toHaveText('MS');
    await assertStableCardFocus(page);
    const cardFieldStyle=el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,border:s.borderBottomColor,width:s.borderBottomWidth,left:s.borderLeftWidth,outline:s.outlineStyle,shadow:s.boxShadow};};
    await assertBoundedTextResize(page);
    for(const label of ['Nome público do autor','Texto da review']){
      const field=page.getByLabel(label);await field.blur();await page.waitForTimeout(180);const base=await field.evaluate(cardFieldStyle);assert.notEqual(base.width,'0px');assert.equal(base.left,'0px');assert.equal(base.background,'rgba(0, 0, 0, 0)');
      await field.hover();await page.waitForTimeout(180);assert.equal((await field.evaluate(cardFieldStyle)).border,base.border);
      await field.focus();await page.waitForTimeout(180);const focus=await field.evaluate(cardFieldStyle);assert.equal(focus.outline,'none');assert.equal(focus.shadow,'none');assert.ok(!['rgb(255, 0, 0)','rgb(227, 6, 19)'].includes(focus.border));
    }
    const slider=page.getByRole('slider',{name:'Avaliação em estrelas'});
    const star4=await page.locator('[data-star="4"]').boundingBox(),star5=await page.locator('[data-star="5"]').boundingBox();
    if(width===1440){
      await page.mouse.move(star4.x+star4.width/4,star4.y+star4.height/2);await expect(page.locator('.rating-value')).toHaveText('3,5 de 5');
      await page.mouse.move(star4.x+star4.width*3/4,star4.y+star4.height/2);await expect(page.locator('.rating-value')).toHaveText('4 de 5');
      await expect(slider).toHaveAttribute('aria-valuenow','5');
      await page.mouse.click(star5.x+star5.width/4,star5.y+star5.height/2);await expect(slider).toHaveAttribute('aria-valuenow','4.5');
      await page.mouse.click(star5.x+star5.width*3/4,star5.y+star5.height/2);await expect(slider).toHaveAttribute('aria-valuenow','5');
    }else{
      await page.touchscreen.tap(star5.x+star5.width/4,star5.y+star5.height/2);await expect(slider).toHaveAttribute('aria-valuenow','4.5');
      await page.touchscreen.tap(star5.x+star5.width*3/4,star5.y+star5.height/2);await expect(slider).toHaveAttribute('aria-valuenow','5');
    }
    await slider.focus();await slider.press('Home');await expect(slider).toHaveAttribute('aria-valuenow','0.5');
    await slider.press('ArrowLeft');await expect(slider).toHaveAttribute('aria-valuenow','0.5');
    await slider.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','1');
    await slider.press('End');await slider.press('ArrowRight');await expect(slider).toHaveAttribute('aria-valuenow','5');
    await slider.press('ArrowLeft');await expect(slider).toHaveAttribute('aria-valuetext','4,5 de 5 estrelas');
    await page.emulateMedia({reducedMotion:'no-preference'});
    const starCardSize=await page.locator('.edit-card').evaluate(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height]);
    await slider.press('ArrowRight');await expect(page.locator('.star-sparks')).toHaveCount(1);await expect(page.locator('.star-sparks svg')).toHaveCount(3);
    assert.equal(await page.locator('.star-sparks').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    assert.equal(await page.locator('.star-sparks svg').first().evaluate(el=>getComputedStyle(el).animationIterationCount),'1');
    assert.deepEqual(await page.locator('.edit-card').evaluate(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height]),starCardSize);
    await page.waitForTimeout(850);await expect(page.locator('.star-sparks')).toHaveCount(0);
    await page.emulateMedia({reducedMotion:'reduce'});await slider.press('ArrowLeft');
    await expect(page.locator('.star-sparks')).toHaveCount(0);
    await page.getByLabel('Texto da review').fill('Atendimento claro e disponível. <script>window.untrusted=true</script>');
    await assertStableCardFocus(page);
    const pendingDialog=page.waitForEvent('dialog');const attemptedLeave=page.goto(origin+'/public').catch(()=>null);
    const dialog=await pendingDialog;assert.equal(dialog.type(),'beforeunload');await dialog.dismiss();await attemptedLeave;
    await expect(page.getByLabel('Nome público do autor')).toHaveValue('Maria Silva');
    const avatarButton=page.getByRole('button',{name:'Adicionar fotografia do autor',exact:true});
    const [chooser]=await Promise.all([page.waitForEvent('filechooser'),width===390?avatarButton.tap():avatarButton.press('Enter')]);
    await chooser.setFiles({name:'photo.png',mimeType:'image/png',buffer:avatar});
    await page.locator('.edit-card .avatar img').waitFor();
    if(process.env.REVIEWS_SCREENSHOTS){
      await page.getByLabel('Texto da review').fill('Atendimento claro e disponível. Todo o processo foi explicado com cuidado e a viatura correspondeu às expectativas.');
      await page.getByLabel('Nome público do autor').focus();
      await page.screenshot({path:path.join(process.env.REVIEWS_SCREENSHOTS,`reviews-editor-${width}.png`),fullPage:true});
      await page.getByLabel('Texto da review').fill('Atendimento claro e disponível. <script>window.untrusted=true</script>');
    }
    failSave=true;await page.getByRole('button',{name:'Guardar review',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.getByLabel('Nome público do autor').inputValue(),'Maria Silva');
    failPhoto=true;await page.getByRole('button',{name:'Guardar review',exact:true}).click();await expect(page.getByRole('alert')).toContainText('foram guardados');assert.equal(items.length,1);
    await page.getByRole('button',{name:'Guardar review',exact:true}).click();await page.getByText('Review guardada.',{exact:false}).waitFor();assert.equal(items.length,1);assert.equal(items[0].rating,4.5);assert.ok(items[0].avatarVersion);
    assert.equal(await page.locator('.saved-stars .half-star').count(),1);
    await page.goto(origin+'/public');await page.locator('.reviews').waitFor();await expect(page.locator('.review-grid:not(.duplicate) h3')).toHaveText('Maria Silva');assert.equal(await page.locator('.review-grid:not(.duplicate) .avatar img').count(),1);assert.equal(await page.evaluate(()=>window.untrusted),undefined);assert.equal(await page.getByText('Verificado',{exact:true}).count(),0);
    await expect(page.locator('.review-grid:not(.duplicate) .stars')).toHaveAttribute('aria-label','4.5 de 5 estrelas');
    assert.equal(await page.locator('.review-grid:not(.duplicate) .half-star').count(),1);
    const halfWidths=await page.locator('.review-grid:not(.duplicate) .half-star').evaluate(el=>[el.getBoundingClientRect().width,parseFloat(getComputedStyle(el,'::after').width)]);assert.ok(Math.abs(halfWidths[0]/2-halfWidths[1])<0.1);
    if(process.env.REVIEWS_SCREENSHOTS)await page.screenshot({path:path.join(process.env.REVIEWS_SCREENSHOTS,`reviews-half-public-${width}.png`),fullPage:true});
    await page.goto(origin+'/crm');await page.getByRole('button',{name:'Editar',exact:true}).click();await expect(page.getByRole('slider')).toHaveAttribute('aria-valuenow','4.5');await page.getByRole('button',{name:'Usar iniciais',exact:true}).click();await expect(page.locator('.edit-card .avatar')).toHaveText('MS');await page.getByLabel('Texto da review').fill('Texto editado.');await page.getByRole('button',{name:'Guardar review',exact:true}).click();await page.getByText('Review guardada.',{exact:false}).waitFor();assert.equal(items[0].avatarVersion,null);assert.equal(items[0].rating,4.5);
    await page.goto(origin+'/public');await expect(page.locator('.review-grid:not(.duplicate) .avatar')).toHaveText('MS');assert.ok((await page.locator('.reviews').innerText()).includes('Texto editado.'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.goto(origin+'/crm');await page.getByRole('button',{name:'Remover',exact:true}).click();await page.getByRole('button',{name:'Remover review',exact:true}).click();await page.getByText('As próximas palavras são dos seus clientes.').waitFor();assert.equal(items.length,0);
    await page.goto(origin+'/public');await page.waitForLoadState('networkidle');assert.equal(await page.locator('.reviews').count(),0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

for(const width of [1440,390])test(`public card geometry stays identical to original static design at ${width}px`,async()=>{
  items=structuredClone(equivalent);
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  const geometry=()=>page.locator('.review-grid:not(.duplicate) article').evaluateAll(es=>es.map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el),a=el.querySelector('.avatar').getBoundingClientRect(),h=getComputedStyle(el.querySelector('h3'));
    return{width:r.width,height:r.height,padding:s.padding,border:s.borderRadius,font:s.fontFamily,avatar:[a.width,a.height],nameSize:h.fontSize};
  }));
  try{await page.goto(origin+'/baseline');await page.locator('.reviews').waitFor();await page.evaluate(()=>document.fonts.ready);const before=await geometry();await page.goto(origin+'/public');await page.locator('.reviews').waitFor();await page.evaluate(()=>document.fonts.ready);assert.deepEqual(await geometry(),before);if(process.env.REVIEWS_SCREENSHOTS)await page.screenshot({path:path.join(process.env.REVIEWS_SCREENSHOTS,`reviews-public-${width}.png`),fullPage:true});}finally{await page.close();}
});

for(const width of [1440,390])test(`site workspace navigation, semantic icons and candidates scroll at ${width}px`,async()=>{
  items=[];
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
  try{
    const redirect=await page.request.get(origin+'/crm/site',{maxRedirects:0});assert.equal(redirect.status(),307);assert.equal(redirect.headers().location,'/crm/site/destaques');
    await page.goto(origin+'/crm/site');const nav=page.getByRole('navigation',{name:'Secções do site público'});
    await expect(page.getByRole('heading',{name:'Site público',exact:true})).toHaveCount(1);
    await expect(nav.getByRole('link',{name:'Destaques da homepage'})).toHaveAttribute('aria-current','page');
    await page.evaluate(()=>document.fonts.ready);const tabBounds=()=>page.getByRole('navigation',{name:'Secções do site público'}).locator('a').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return[r.left,r.top+scrollY,r.width,r.height];}));const beforeTabs=await tabBounds();
    assert.equal(await nav.locator('a svg.lucide-star').count(),1);assert.equal(await page.locator('svg.lucide-star').count(),2);assert.equal(await nav.locator('a svg.lucide-message-square').count(),1);
    await nav.getByRole('link',{name:'Reviews',exact:true}).click();await expect(page.getByRole('navigation').getByRole('link',{name:'Reviews',exact:true})).toHaveAttribute('aria-current','page');
    await page.evaluate(()=>document.fonts.ready);assert.deepEqual(await tabBounds(),beforeTabs);
    assert.equal(await page.getByRole('link',{name:'Gerir destaques',exact:true}).count(),0);
    await page.goBack();await expect(page.getByRole('navigation').getByRole('link',{name:'Destaques da homepage'})).toHaveAttribute('aria-current','page');
    await page.evaluate(()=>document.fonts.ready);assert.deepEqual(await tabBounds(),beforeTabs);
    const search=page.getByPlaceholder('Marca, modelo ou ano');
    const candidates=page.getByRole('region',{name:'Viaturas publicadas disponíveis para destaque'});const dimensions=await candidates.evaluate(el=>[el.clientHeight,el.scrollHeight]);assert.ok(dimensions[0]<dimensions[1]);assert.ok(dimensions[0]<=420);
    await candidates.focus();const before=await search.boundingBox();await candidates.press('End');await expect.poll(()=>candidates.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);assert.deepEqual(await search.boundingBox(),before);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(process.env.REVIEWS_SCREENSHOTS)await page.screenshot({path:path.join(process.env.REVIEWS_SCREENSHOTS,`site-sections-highlights-${width}.png`),fullPage:true});
    await search.fill('Modelo 40');await expect(candidates.locator('.candidate')).toHaveCount(1);
  }finally{await page.close();}
});
