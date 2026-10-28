// Local fixtures only; does not contact or change the live backend.
// Run from apps/website: node test/thumbnailFollow.browser.mjs
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
const configPath=path.resolve('.svelte-kit/thumbnail-follow-vite.config.mjs');
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
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    if (attempt > 100 || vite.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });
  for(const width of [1440,900,390])for(const count of [18,2]){
    vehicles[0].photos=Array.from({length:count},(_,n)=>`/api/public/vehicles/${vehicles[0].slug}/photos/${n}?v=${version(n+1)}`);
    const context=await browser.newContext({viewport:{width,height:950},isMobile:width===390,hasTouch:width===390,reducedMotion:width===900?'reduce':'no-preference'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const settle=()=>page.waitForTimeout(240);
    const metrics=strip=>strip.evaluate(node=>{
      const style=getComputedStyle(node),horizontal=style.flexDirection.startsWith('row'),box=node.getBoundingClientRect();
      const start=(horizontal?box.left+node.clientLeft:box.top+node.clientTop)+parseFloat(horizontal?style.paddingLeft:style.paddingTop);
      const end=(horizontal?box.left+node.clientLeft+node.clientWidth:box.top+node.clientTop+node.clientHeight)-parseFloat(horizontal?style.paddingRight:style.paddingBottom);
      const items=[...node.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect();return {start:horizontal?r.left:r.top,end:horizontal?r.right:r.bottom,active:button.getAttribute('aria-pressed')==='true'};});
      const index=items.findIndex(item=>item.active),active=items[index];
      return {horizontal,start,end,index,active,items,current:horizontal?node.scrollLeft:node.scrollTop,maximum:Math.max(0,horizontal?node.scrollWidth-node.clientWidth:node.scrollHeight-node.clientHeight),ratio:((active.start+active.end)/2-start)/(end-start),page:window.scrollY,overlay:document.querySelector('.gallery-dialog')?.scrollTop??0};
    });
    const check=async(strip,direction)=>{
      await settle();const m=await metrics(strip);
      assert.ok(m.current>=0&&m.current<=m.maximum+.5);
      assert.ok(m.active.start>=m.start-1&&m.active.end<=m.end+1,'selected thumbnail stays fully visible');
      if(m.current>1&&m.current<m.maximum-1)assert.ok(Math.abs(m.ratio-(direction>0?.35:.65))<.02,'selection is positioned early with directional context');
      if(count===18&&m.index>2&&m.index<count-3){
        const contextItems=direction>0?m.items.slice(m.index+1).filter(item=>item.start<m.end-6):m.items.slice(0,m.index).filter(item=>item.end>m.start+6);
        assert.ok(contextItems.length>=2,'multiple thumbnails are visible ahead of travel');
      }
      return m;
    };
    try{
      await page.route('**/*',route=>{
        const url=new URL(route.request().url()),index=Number(url.pathname.split('/').at(-1));
        if(url.pathname.includes('/photos/')&&!url.pathname.endsWith('/access'))return route.fulfill({contentType:'image/png',headers:{'x-photo-version':version(index+1)},body:photos[index%3]??photos[0]});
        return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
      });
      await page.goto(`${origin}/viaturas/${vehicles[0].slug}`);
      await page.waitForFunction(()=>document.querySelector('.vehicle-photo .photo-rail-track')?.dataset.moving==='false');
      for(const fullscreen of [false,true]){
        if(fullscreen){await page.locator('.vehicle-photo .photo-rail-slide:not([inert]) button').click();await page.locator('.gallery-dialog').waitFor({state:'visible'});}
        const strip=page.locator(fullscreen?'.viewer-thumbnails':'.detail-thumbnails');
        const next=page.locator(fullscreen?'.viewer-next':'.photo-next'),previous=page.locator(fullscreen?'.viewer-previous':'.photo-previous');
        if(!fullscreen){await page.locator('.vehicle-photo-stage').hover();await page.waitForTimeout(320);}
        await next.scrollIntoViewIfNeeded();await settle();
        const pageStart=await page.evaluate(()=>scrollY);
        for(let i=1;i<=Math.min(8,count-1);i++){await next.click();const m=await check(strip,1);assert.equal(m.index,i);assert.equal(m.page,pageStart,'navigation scrolls only the thumbnail strip');assert.equal(m.overlay,0);}
        if(count===18){
          for(let i=7;i>=3;i--){await previous.click();const m=await check(strip,-1);assert.equal(m.index,i);assert.equal(m.page,pageStart);}
          if(fullscreen){await page.keyboard.press('ArrowRight');assert.equal((await check(strip,1)).index,4);}
          else{await next.focus();await page.keyboard.press('ArrowRight');assert.equal((await check(strip,1)).index,4);}
          await strip.locator('button').nth(5).click();assert.equal((await check(strip,1)).index,5);
          await strip.scrollIntoViewIfNeeded();const before=await metrics(strip);await strip.hover();await page.mouse.wheel(125,0);await page.waitForTimeout(150);const manual=await metrics(strip);await page.waitForTimeout(500);const retained=await metrics(strip);
          assert.equal(retained.index,before.index);assert.ok(Math.abs(retained.current-manual.current)<1,'manual scrolling is not pulled back');
          if(!fullscreen&&width>700){
            const box=await strip.boundingBox(),index=retained.index;
            await page.mouse.move(box.x+box.width*.65,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5,{steps:10});await page.mouse.up();await page.waitForTimeout(650);
            const dragged=await metrics(strip);await page.waitForTimeout(250);assert.equal(dragged.index,index);assert.ok(Math.abs((await metrics(strip)).current-dragged.current)<1,'manual drag keeps its position');
          }
          if(!fullscreen){await page.locator('.vehicle-photo-stage').hover();await page.waitForTimeout(320);}
          await next.click();await check(strip,1);
          if(fullscreen&&width===390){
            // Swipe changes the same selection and uses the same anticipatory rule.
            await page.waitForTimeout(450);const stage=page.locator('.gallery-dialog .viewer-stage'),box=await stage.boundingBox(),cdp=await context.newCDPSession(page),x=box.x+box.width*.65,y=box.y+box.height*.45;
            const beforeSwipe=(await metrics(strip)).index;
            await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
            for(let step=1;step<=6;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-step*20,y}]});await page.waitForTimeout(25);}
            await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await check(strip,1)).index,beforeSwipe+1);
            await page.setViewportSize({width:844,height:390});await settle();assert.equal((await metrics(strip)).horizontal,false);await check(strip,1);
            const pageAfterResize=await page.evaluate(()=>scrollY);await previous.click();assert.equal((await check(strip,-1)).page,pageAfterResize);
          }
          await strip.locator('button').nth(count-1).click();const last=await check(strip,1);assert.ok(Math.abs(last.current-last.maximum)<1,'last photo clamps at the strip end');
          await strip.locator('button').first().click();assert.ok((await check(strip,-1)).current<1,'jump to first returns to the beginning');
        }else{assert.equal((await metrics(strip)).maximum,0);await previous.click();assert.equal((await metrics(strip)).current,0);}
        if(fullscreen)await page.locator('.gallery-dialog .dialog-close').click();
      }
      assert.deepEqual(errors,[]);console.log(`PASS anticipatory thumbnails ${width}px ${count} photos inline + fullscreen`);
    }catch(error){console.error(logs.slice(-1500));await page.screenshot({path:`.svelte-kit/thumbnail-follow-failure-${width}-${count}.png`});throw error;}
    finally{await context.close();}
  }
}finally{await browser?.close();vite.kill();await new Promise(resolve=>backend.close(resolve));await rm(configPath,{force:true});}
