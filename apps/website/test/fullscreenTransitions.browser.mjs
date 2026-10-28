// Local fixtures only; does not contact or change the live backend.
// Run from apps/website: node test/fullscreenTransitions.browser.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir,writeFile,realpath,rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const photos = await Promise.all(
  ['#f5f5f0', '#111820', '#6c8475'].map((color, n) =>
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${n === 1 ? 1600 : 900}"><rect width="1200" height="${n === 1 ? 1600 : 900}" fill="${color}"/><text x="400" y="450" font-size="80">Foto ${n + 1}</text></svg>`,
      ),
    )
      .png()
      .toBuffer(),
  ),
);

const version=n=>n.toString(16).padStart(64,"0");
const vehicles = Array.from({ length: 5 }, (_, i) => {
  const slug = `gallery-check-${String(i).padStart(12, 'a')}`;
  return {
    slug,
    brand: 'Marca',
    model: `Modelo ${i + 1}`,
    year: 2023,
    fuel: 'GASOLINE',
    mileage: 20000,
    price: '20000.00',
    currency: 'EUR',
    description: 'Viatura de teste local.',
    transmission: 'MANUAL',
    availability: 'AVAILABLE',
    photos: Array.from({length:18},(_,n)=>n).map((n) => `/api/public/vehicles/${slug}/photos/${n}?v=${version(n+1)}`),
  };
});
const backend = createServer((req, res) => {
  const url=new URL(req.url,'http://fixture');
  if(/\/photos\/\d+$/.test(url.pathname)){res.setHeader('content-type','image/png');res.setHeader('x-photo-version',version(Number(url.pathname.split('/').at(-1))+1));res.end(photos[Number(url.pathname.split('/').at(-1))%3]);return;}
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(url.pathname.endsWith('/photos/access')?{versions:vehicles[0].photos.map((_,i)=>version(i+1))}:url.pathname.endsWith('/related')?vehicles:vehicles[0]));
});
await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${backend.address().port}`;
const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));
const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
await mkdir('.svelte-kit',{recursive:true});
const configPath=path.resolve('.svelte-kit/fullscreen-transitions-vite.config.mjs');
await writeFile(configPath,'import base from '+JSON.stringify(path.resolve('vite.config.ts'))+';export default {...base,server:{...base.server,fs:{allow:'+JSON.stringify([path.resolve('../..'),await realpath('../../node_modules')])+ '}}};');
const origin = `http://127.0.0.1:${port}`;
const vite = spawn(
  process.execPath,
  [
    '../../node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort', '--config', configPath,
  ],
  {
    env: { ...process.env, PUBLIC_BACKEND_URL: api },
    stdio: 'pipe',
  },
);
let logs = '';
vite.stdout.on('data', (data) => {
  logs += data;
});
vite.stderr.on('data', (data) => {
  logs += data;
});
let browser;
try{
 for(let i=0;;i++){try{if((await fetch(origin)).ok)break;}catch{}if(i>100||vite.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
 for(const width of [1440,390])for(const motion of ['no-preference','reduce']){
 const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390,reducedMotion:motion});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.route('**/*',r=>{const u=new URL(r.request().url()),n=Number(u.pathname.split('/').at(-1));if(u.pathname.includes('/photos/')&&!u.pathname.endsWith('/access'))return r.fulfill({contentType:'image/png',headers:{'x-photo-version':version(n+1)},body:photos[n%3]||photos[0]});return ['127.0.0.1','localhost'].includes(u.hostname)?r.continue():r.abort();});
 await page.goto(origin+'/viaturas/'+vehicles[0].slug);await page.waitForFunction(()=>document.querySelector('.vehicle-photo .photo-rail-track')?.dataset.moving==='false');
 await page.evaluate(()=>{window.railMoves=[];const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){const result=animate.call(this,frames,options);if(this.classList.contains('photo-rail-track')){const row={fullscreen:!!this.closest('.fullscreen'),frames,options,positions:[]};window.railMoves.push(row);const record=()=>{if(!this.isConnected)return;row.positions.push(-new DOMMatrixReadOnly(getComputedStyle(this).transform).m41/this.clientWidth);if(result.playState==='running')requestAnimationFrame(record);};requestAnimationFrame(record);}return result;};});
 assert.equal(await page.locator('.detail-thumbnails button:not(.contact-thumbnail) span').count(),0,'inline thumbnails have no visual numbers');assert.equal(await page.locator('.detail-thumbnails button').first().getAttribute('aria-label'),'Ver fotografia 1');assert.match(await page.locator('.photo-counter').textContent(),/1\s*\/\s*18/);
 // Inline keeps its existing longer contiguous travel.
 await page.locator('.detail-thumbnails button').nth(4).click();await page.waitForTimeout(800);
 if(motion==='no-preference'){const m=await page.evaluate(()=>window.railMoves.at(-1));assert.equal(m.fullscreen,false);assert.ok(m.positions.some(p=>p>.2&&p<3.8));}
 await page.locator('.detail-thumbnails button').first().click();await page.waitForTimeout(800);await page.locator('.photo-expand').click();await page.waitForTimeout(550);
 const rail=page.locator('.gallery-dialog .photo-rail-track'),thumbs=page.locator('.viewer-thumbnails button'),next=page.locator('.viewer-next');
 const selected=()=>page.locator('.viewer-thumbnails').evaluate(n=>[...n.querySelectorAll('button')].findIndex(b=>b.getAttribute('aria-pressed')==='true'));
 const reset=()=>page.evaluate(()=>window.railMoves=[]);
 const check=async(target,distant)=>{await page.waitForTimeout(distant?190:550);assert.equal(await selected(),target);assert.ok((await page.locator('.viewer-photo-position').textContent()).includes(target===18?'Fale connosco':(target+1)+' / 18'));assert.equal((await page.evaluate(()=>window.railMoves.filter(m=>!m.fullscreen))).length,0,'inline stays still behind the modal');const moves=await page.evaluate(()=>window.railMoves.filter(m=>m.fullscreen));if(motion==='reduce'){assert.equal(moves.length,0);}else{const m=moves.at(-1);assert.ok(m);if(distant){assert.ok(m.options.duration<=150);assert.ok(m.positions.length>0);assert.ok(m.positions.every(p=>Math.abs(p-target)<.005),'distant selection never traverses an intermediate photo');assert.ok(m.frames.every(f=>!('transform'in f)));}else{assert.ok(m.positions.some(p=>Math.abs(p-target)>.03&&Math.abs(p-target)<.97),'one/two-photo selection slides through intermediate positions');}}assert.equal(await rail.getAttribute('data-moving'),'false');};
 await reset();await next.click();await check(1,false);
 for(const [target,distant] of [[4,true],[2,false],[0,false],[2,false],[6,true],[0,true]]){await reset();await thumbs.nth(target).click();await check(target,distant);}
 await reset();for(const target of [5,2,6])await thumbs.nth(target).click();await check(6,true);
 await reset();await next.click();await page.waitForTimeout(40);await reset();await thumbs.nth(2).click();await check(2,true);
 await reset();await next.focus();await page.keyboard.press('ArrowRight');await check(3,false);
 if(width===390){await reset();const b=await page.locator('.viewer-stage').boundingBox(),cdp=await context.newCDPSession(page),x=b.x+b.width*.65,y=b.y+b.height*.45;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*20,y}]});await page.waitForTimeout(25);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await check(4,false);}
 await reset();await thumbs.last().click();await check(18,true);await reset();await page.locator('.viewer-previous').click();await check(17,false);
 await next.click();await page.waitForTimeout(450);await reset();assert.equal(await next.getAttribute('aria-disabled'),'true');await next.evaluate(n=>n.click());await page.waitForTimeout(160);assert.equal(await selected(),18);assert.equal((await page.evaluate(()=>window.railMoves)).length,0,'end is clamped without a wrap');
 await thumbs.first().click();await page.waitForTimeout(190);
 // Missing decoded pixels use the direct fallback and cannot cause lateral travel.
 await rail.evaluate(n=>n.children[9].querySelector('img').removeAttribute('src'));await reset();await thumbs.nth(9).click();await page.waitForTimeout(190);assert.equal(await selected(),9);assert.equal((await page.evaluate(()=>window.railMoves)).length,0);
 await thumbs.first().click();await page.waitForTimeout(190);await rail.evaluate(n=>n.children[2].querySelector('img').removeAttribute('src'));await reset();await thumbs.nth(2).click();await page.waitForTimeout(190);assert.equal(await selected(),2);assert.equal((await page.evaluate(()=>window.railMoves)).length,0,'unloaded two-position target retains direct fallback');await thumbs.first().click();await page.waitForTimeout(550);await thumbs.nth(4).click();await page.setViewportSize({width:width+20,height:820});await page.waitForTimeout(200);assert.equal(await rail.getAttribute('data-moving'),'false');assert.equal(await selected(),4);
 await thumbs.first().click();await page.keyboard.press('Escape');await page.locator('.gallery-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('.gallery-dialog .photo-rail-track'));
 assert.deepEqual(errors,[]);console.log('PASS fullscreen one/two-photo slides, distant quick fades, interruption, fallback '+width+'px '+motion);
 }catch(e){console.error(logs.slice(-1500));await page.screenshot({path:'.svelte-kit/fullscreen-transitions-failure-'+width+'-'+motion+'.png'});throw e;}finally{await context.close();}
 }
}finally{await browser?.close();vite.kill();await new Promise(r=>backend.close(r));await rm(configPath,{force:true});}
