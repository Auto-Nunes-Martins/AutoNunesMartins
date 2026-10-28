// Local fixtures only; does not contact or change the live backend.
// Run from apps/website: node test/fullscreenViewport.browser.mjs
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
const configPath=path.resolve('.svelte-kit/fullscreen-viewport-vite.config.mjs');
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
try {
  for(let i=0;;i++){try{if((await fetch(origin)).ok)break;}catch{}if(i>100||vite.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
  for(const [width,height,touch] of [[1920,950,false],[1440,650,false],[900,500,false],[844,390,true],[667,320,true],[390,844,true]])for(const count of [18,2]){
    vehicles[0].photos=Array.from({length:count},(_,n)=>'/api/public/vehicles/'+vehicles[0].slug+'/photos/'+n+'?v='+version(n+1));
    const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,reducedMotion:width===900?'reduce':'no-preference'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const settle=()=>page.waitForTimeout(260);
    const metrics=()=>page.locator('.viewer-thumbnails').evaluate(n=>{
      const s=getComputedStyle(n),h=s.flexDirection==='row',b=n.getBoundingClientRect();
      const start=(h?b.left:b.top)+parseFloat(h?s.paddingLeft:s.paddingTop),end=(h?b.right:b.bottom)-parseFloat(h?s.paddingRight:s.paddingBottom);
      const items=[...n.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {start:h?r.left:r.top,end:h?r.right:r.bottom,active:e.getAttribute('aria-pressed')==='true'};});
      return {h,start,end,items,selected:items.findIndex(e=>e.active),current:h?n.scrollLeft:n.scrollTop,max:h?n.scrollWidth-n.clientWidth:n.scrollHeight-n.clientHeight,scrollbar:s.scrollbarWidth,box:{x:b.x,y:b.y,width:b.width,height:b.height}};
    });
    const check=async()=>{
      await settle();const m=await metrics(),active=m.items[m.selected],visible=m.items.filter(e=>e.end>m.start+.5&&e.start<m.end-.5);
      assert.ok(active.start>=m.start-1&&active.end<=m.end+1,'active thumbnail fully visible');
      assert.ok(visible.every(e=>e.start>=m.start-1&&e.end<=m.end+1),'automatic positioning leaves whole cells at both edges');
      assert.ok(visible.length<=(m.h?(height<=650?10:14):6),'bounded visible count');
      assert.equal(m.scrollbar,'none');assert.ok(m.current>=0&&m.current<=m.max+1);
      assert.ok(m.box.x>=0&&m.box.y>=0&&m.box.x+m.box.width<=page.viewportSize().width+1&&m.box.y+m.box.height<=page.viewportSize().height+1);
      return m;
    };
    try{
      await page.route('**/*',r=>{const u=new URL(r.request().url()),n=Number(u.pathname.split('/').at(-1));if(u.pathname.includes('/photos/')&&!u.pathname.endsWith('/access'))return r.fulfill({contentType:'image/png',headers:{'x-photo-version':version(n+1)},body:photos[n%3]||photos[0]});return ['127.0.0.1','localhost'].includes(u.hostname)?r.continue():r.abort();});
      await page.goto(origin+'/viaturas/'+vehicles[0].slug);
      await page.waitForFunction(()=>document.querySelector('.vehicle-photo .photo-rail-track')?.dataset.moving==='false');
      const opener=page.locator('.photo-expand');await opener.click();await page.waitForTimeout(550);
      const dialog=page.locator('.gallery-dialog'),strip=page.locator('.viewer-thumbnails'),next=page.locator('.viewer-next'),previous=page.locator('.viewer-previous');
      assert.equal(await dialog.evaluate(d=>d.contains(document.activeElement)),true);
      let initial=await check();assert.equal(initial.items.length,count+1,'all photos and contact remain in the DOM');
      for(let i=1;i<=Math.min(6,count-1);i++){if(touch)await next.tap();else await next.click();assert.equal((await check()).selected,i);}
      await previous.click();await check();await page.keyboard.press('ArrowRight');await check();
      // Neither a focused scroll container nor a keyboard-focused arrow draws a frame.
      for(const target of [dialog,strip,next]){
        await target.evaluate(n=>n.focus({preventScroll:true}));await page.keyboard.press('ArrowRight');await settle();
        assert.equal(await target.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
      }
      await next.focus();await page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(d=>d.contains(document.activeElement)),true,'Tab remains in modal');
      await next.focus();await page.keyboard.press('ArrowLeft');
      assert.equal(await next.evaluate(n=>getComputedStyle(n.querySelector('svg')).strokeWidth),'3px','keyboard focus changes the control icon');
      assert.equal(await dialog.locator('button').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).borderTopWidth==='0px')),true,'no fullscreen button borders');
      if(count===18){
        // Every photo remains reachable with the ordinary controls, including both ends.
        for(let i=0;i<count+1;i++)await page.keyboard.press('ArrowRight');
        assert.equal((await check()).selected,count);await page.waitForTimeout(450);const cta=page.locator('.gallery-dialog .contact-actions button');await cta.focus();assert.equal(await cta.evaluate(n=>getComputedStyle(n).outlineStyle),'none');assert.equal(await cta.evaluate(n=>getComputedStyle(n).textDecorationLine),'underline','contact action retains keyboard feedback');await cta.hover();assert.equal(await cta.evaluate(n=>getComputedStyle(n).boxShadow),'none','contact action has no decorative halo');const end=await metrics();assert.ok(Math.abs(end.current-end.max)<1);
        await next.focus();for(let i=0;i<count+1;i++)await page.keyboard.press('ArrowLeft');
        assert.equal((await check()).selected,0);assert.ok((await metrics()).current<1);
        await strip.hover();const m=await metrics();await page.mouse.wheel(m.h?180:0,m.h?0:120);await page.waitForTimeout(250);const manually=await metrics();await page.waitForTimeout(450);assert.ok(Math.abs((await metrics()).current-manually.current)<1,'manual scrolling is not pulled back');
        await next.click();await check();
        if(touch){
          await page.waitForTimeout(450);const b=await page.locator('.viewer-stage').boundingBox(),cdp=await context.newCDPSession(page),x=b.x+b.width*.65,y=b.y+b.height*.5,selected=(await metrics()).selected;
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
          for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*20,y}]});await page.waitForTimeout(25);}
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await check()).selected,selected+1);
        }
        if(width===844||width===1440){await page.screenshot({path:'.svelte-kit/fullscreen-viewport-'+width+'.png'});await page.setViewportSize(width===844?{width:390,height:844}:{width:900,height:500});await check();}
      }else{assert.equal((await metrics()).max,0);}
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.gallery-dialog .photo-rail-slide:not([inert]) img').evaluate(n=>n.naturalWidth>0),true,'actual active image is decoded');
      const close=page.locator('.gallery-dialog .dialog-close');await close.hover();assert.ok(!(await close.evaluate(n=>getComputedStyle(n).boxShadow)).includes('255, 255, 255'),'close hover has no white halo');await page.mouse.down();assert.ok(!(await close.evaluate(n=>getComputedStyle(n).boxShadow)).includes('255, 255, 255'),'pressed close has no white halo');await page.mouse.up();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.classList.contains('photo-expand'));assert.equal(await opener.evaluate(n=>n===document.activeElement),true,'focus returns to opener');
      await opener.click();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.classList.contains('photo-expand'));if(count===18){await page.locator('.vehicle-photo .photo-rail-slide:not([inert]) button').click();await dialog.waitFor({state:'visible'});await next.click();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.classList.contains('photo-expand'));}assert.deepEqual(errors,[]);console.log('PASS fullscreen bounded thumbnails and borderless focus '+width+'x'+height+' '+count+' photos');
    }catch(e){console.error(logs.slice(-2000));await page.screenshot({path:'.svelte-kit/fullscreen-viewport-failure-'+width+'-'+count+'.png'});throw e;}
    finally{await context.close();}
  }
}finally{await browser?.close();vite.kill();await new Promise(r=>backend.close(r));await rm(configPath,{force:true});}
