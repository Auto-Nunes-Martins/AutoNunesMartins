// Built website and read-only fixtures. Set PLAYWRIGHT_CHANNEL=chrome; optional --image=<local JPEG>.
// AXE_CORE_PATH can point to another local axe.min.js installation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';

const items = Array.from({ length: 6 }, (_, i) => ({
  brand: 'Teste', model: `Modelo ${i + 1}`, slug: `modelo-${i + 1}-abcdef123456`,
  year: 2020 + i, fuel: 'DIESEL', mileage: 20000, price: '21000.00', currency: 'EUR',
  description: null, transmission: null, availability: 'AVAILABLE',
  photos: [`/api/public/vehicles/modelo-${i + 1}-abcdef123456/photos/0`],
}));
const catalog = {
  items, total: items.length, page: 1, pageSize: 30, totalPages: 1,
  facets: { brands: [{ value: 'Teste', count: 5 }], models: [], fuels: [], transmissions: [],
    year: { min: 2020, max: 2024 }, mileage: { min: 20000, max: 20000 },
    price: { min: '21000.00', max: '21000.00' } },
};
const localImage=process.argv.find(arg=>arg.startsWith('--image='))?.slice(8);
const png = localImage?readFileSync(localImage):Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const listen = async server => {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port;
};
let relatedCount=5;
items[1].model="Modelo com designação muito longa de edição especial";items[2].transmission=null;items[2].price=null;
const api = createServer((req, res) => {
  const path = new URL(req.url, 'http://fixture').pathname.replace('/api/public/vehicles', '');
  if (path.includes('/photos/')) { res.writeHead(200, { 'content-type': localImage?'image/jpeg':'image/png' }); res.end(png); return; }
  const data = path === '/selection' ? {items:new URL(req.url,'http://fixture').searchParams.getAll('id').map(id=>({id,status:items.some(v=>v.slug===id)?200:404,vehicle:items.find(v=>v.slug===id)??null}))} : path === '/brands' ? catalog.facets.brands
    : path === '/homepage-highlights' ? { configured: true, items: items.map(vehicle => ({ vehicle, photoIndex: 0 })) }
    : path.endsWith('/related') ? items.filter(v => !path.includes(v.slug)).slice(0,relatedCount) : items.find(v => path === `/${v.slug}`) ?? catalog;
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
});
let child,browser;const results=[];
try{
 const backendPort = await listen(api);
  const probe = createServer(); const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['build/index.js'], { cwd: 'apps/website', stdio: 'pipe', env: {
    ...process.env, PORT: String(port), HOST: '127.0.0.1', ORIGIN: origin,
    INTERNAL_BACKEND_URL: `http://127.0.0.1:${backendPort}`, SITE_NOINDEX: 'true',
  } });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await fetch(origin); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert(ready, 'fixture website starts');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  await page.route('https://images.unsplash.com/**', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

for(const width of[1440,390])for(const theme of['light','dark']){
await page.setViewportSize({width,height:1000});await page.goto(origin+'/viaturas/'+items[0].slug);await page.waitForFunction(()=>document.querySelector('[data-theme-command]')&&!document.querySelector('[data-theme-command]').disabled);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
const carousel=page.locator('.carousel');await carousel.locator('.integrated-controls').waitFor();await carousel.scrollIntoViewIfNeeded();
const first=()=>carousel.locator('[data-vehicle]').first().getAttribute('data-vehicle');const initial=await first();
const integratedNext=carousel.getByRole('button',{name:'Viatura seguinte · navegação integrada',exact:true});await integratedNext.click();await page.waitForTimeout(100);assert(await integratedNext.evaluate(el=>el===document.activeElement),'integrated navigation retains keyboard focus');assert.notEqual(await first(),initial);assert.equal(await carousel.locator('.integrated-controls button').count(),2);
await carousel.getByRole('button',{name:'Viatura anterior',exact:true}).click();await page.waitForTimeout(100);assert.equal(await first(),initial);
await carousel.locator('.viewport').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);assert.notEqual(await first(),initial);
const beforeDrag=await first(),box=await carousel.locator('.viewport').boundingBox();await page.mouse.move(box.x+box.width*.6,box.y+80);await page.mouse.down();await page.mouse.move(box.x+box.width*.6-120,box.y+80,{steps:8});await page.mouse.up();await page.waitForTimeout(100);assert.notEqual(await first(),beforeDrag);
await page.emulateMedia({reducedMotion:'no-preference'});
const beforeRapid=Number((await carousel.locator('.controls > span').innerText()).split('/')[0]);
await carousel.evaluate(el=>{window.__carouselDisabled=false;window.__carouselObserver=new MutationObserver(()=>{if(el.querySelector('button:disabled'))window.__carouselDisabled=true;});window.__carouselObserver.observe(el,{subtree:true,attributes:true,attributeFilter:['disabled']});});
await integratedNext.click({clickCount:3,delay:35});
await page.waitForTimeout(1250);
assert.equal(Number((await carousel.locator('.controls > span').innerText()).split('/')[0]),(beforeRapid-1+3)%5+1,'three rapid clicks complete three sequential movements');
assert(await integratedNext.evaluate(el=>el===document.activeElement),'rapid clicks preserve focus');
assert.equal(await carousel.locator('button:disabled').count(),0);
assert.equal(await page.evaluate(()=>{window.__carouselObserver.disconnect();return window.__carouselDisabled;}),false,'buttons never become disabled during transitions');
await carousel.getByRole('button',{name:'Viatura anterior',exact:true}).click({clickCount:3,delay:35});await page.waitForTimeout(1250);
assert.equal(Number((await carousel.locator('.controls > span').innerText()).split('/')[0]),beforeRapid,'queued reverse movement preserves loop order');
const overlay=await carousel.locator('.carousel-stage').evaluate(el=>{const stage=el.getBoundingClientRect(),viewport=el.querySelector('.viewport').getBoundingClientRect();return{padding:getComputedStyle(el).paddingInlineStart,width:stage.width,viewportWidth:viewport.width,targets:[...el.querySelectorAll('.integrated-controls button')].every(button=>{const r=button.getBoundingClientRect();return r.left>=stage.left&&r.right<=stage.right&&button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})};});
assert.equal(overlay.padding,'0px');assert(Math.abs(overlay.width-overlay.viewportWidth)<1,'cards use the full stage width');assert(overlay.targets,'overlaid controls receive pointer input');
await page.emulateMedia({reducedMotion:'reduce'});
await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(300);
const edgeCard=carousel.locator('[data-vehicle] .vehicle-card').first();
const edgeBox=await edgeCard.boundingBox();const edgeClip={x:Math.floor(edgeBox.x)-12,y:Math.floor(edgeBox.y)+40,width:10,height:100};
const beforeShadow=await sharp(await page.screenshot({clip:edgeClip})).raw().toBuffer();
await edgeCard.hover();await page.waitForTimeout(300);
const afterShadow=await sharp(await page.screenshot({clip:edgeClip})).raw().toBuffer();
assert(afterShadow.some((v,i)=>Math.abs(v-beforeShadow[i])>2),'hover shadow paints beyond the left viewport edge');
await page.mouse.move(0,0);await edgeCard.locator('.card-price a').focus();await page.waitForTimeout(300);
const focusedShadow=await sharp(await page.screenshot({clip:edgeClip})).raw().toBuffer();
assert(focusedShadow.some((v,i)=>Math.abs(v-beforeShadow[i])>2),'focus shadow paints beyond the left viewport edge');
assert.equal(await carousel.locator('.ghost').evaluateAll(els=>els.every(el=>getComputedStyle(el).visibility==='hidden')),true,'loop helpers stay hidden in the paint margin at rest');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'paint margin creates no horizontal page overflow');
await page.setViewportSize({width:width===1440?1280:430,height:1000});await page.waitForTimeout(100);assert.equal(await carousel.locator('.integrated-controls button').count(),2);await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
const navigation=await carousel.locator('.integrated-controls button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect(),stage=b.closest('.carousel-stage').getBoundingClientRect(),image=b.closest('.carousel-stage').querySelector('.card-image').getBoundingClientRect();return{width:r.width,height:r.height,cy:r.top+r.height/2,imageTop:image.top,imageBottom:image.bottom,stageTop:stage.top,stageBottom:stage.bottom};}));assert(navigation.every(b=>b.width>=44&&b.height>=44&&b.cy>=b.imageTop&&b.cy<=b.imageBottom),'controls sit inside the photo area with full targets');await page.evaluate(()=>document.activeElement?.blur());await page.locator('.related').screenshot({path:'.cache/gallery-follow/related-integrated-'+width+'-'+theme+'.png'});
for(const count of[1,2,3]){
await page.evaluate(ids=>localStorage.setItem('anm-comparison-v1',JSON.stringify(ids)),items.slice(0,count).map(v=>v.slug));await page.goto(origin+'/comparar');await page.locator('.comparison-board .price').first().waitFor();await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.waitForTimeout(100);
const state=await page.locator('.comparison-board').evaluate(el=>{const photos=[...el.querySelectorAll('.photo-row img')].map(img=>img.getBoundingClientRect().height);const rows=[...el.querySelectorAll('.fact-value')].map(td=>{const r=td.getBoundingClientRect();return{align:getComputedStyle(td).textAlign,width:r.width,height:r.height};});return{photos,rows,width:el.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth};});assert(!state.overflow);assert(state.photos.every(h=>h<=211));assert(state.rows.every(r=>r.align==='left'));assert.equal(await page.locator('.fact-label').first().evaluate(el=>getComputedStyle(el).textAlign),'left');const mainLeft=await page.locator('.comparison-page').evaluate(el=>el.getBoundingClientRect().left);const boardLeft=await page.locator('.comparison-board').evaluate(el=>el.getBoundingClientRect().left);assert(Math.abs(mainLeft-boardLeft)<1,'comparison aligns with page frame');
await page.locator('.comparison-page').screenshot({path:'.cache/gallery-follow/comparison-compact-'+width+'-'+theme+'-'+count+'.png'});results.push({viewportWidth:width,theme,count,...state});}
}
for(const count of[0,1]){relatedCount=count;await page.goto(origin+'/viaturas/'+items[0].slug);await page.waitForTimeout(200);assert.equal(await page.locator('.carousel .controls').count(),0);assert.equal(await page.locator('.integrated-controls').count(),0);}
assert.deepEqual(errors,[]);await writeFile('.cache/gallery-follow/public-layout-check.json',JSON.stringify(results,null,2));console.log('PASS related 0/1/5 items, both navigation bars + keyboard; comparison 1/2/3, long/missing data, mobile/desktop, both themes, left alignment and internal arrow placement');
}finally{await browser?.close();child?.kill();await new Promise(resolve=>api.close(resolve));}
