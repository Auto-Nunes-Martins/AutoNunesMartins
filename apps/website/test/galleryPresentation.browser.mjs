// Local fixtures only; does not contact or change the live backend.
// Run from apps/website: node test/galleryPresentation.browser.mjs
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
    photos: [0, 1, 2].map((n) => `/api/public/vehicles/${slug}/photos/${n}?v=${String(n+1).repeat(64)}`),
  };
});
const backend = createServer((req, res) => {
  const url=new URL(req.url,'http://fixture');
  if(/\/photos\/\d+$/.test(url.pathname)){res.setHeader('content-type','image/png');res.setHeader('x-photo-version',String(Number(url.pathname.split('/').at(-1))+1).repeat(64));res.end(photos[Number(url.pathname.split('/').at(-1))]);return;}
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(url.pathname.endsWith('/photos/access')?{versions:[1,2,3].map(n=>String(n).repeat(64))}:url.pathname.endsWith('/related')?vehicles:vehicles[0]));
});
await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${backend.address().port}`;
const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));
const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
await mkdir('.svelte-kit',{recursive:true});
const configPath=path.resolve('.svelte-kit/gallery-presentation-vite.config.mjs');
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
  vehicles[0].brand='Mercedes-Benz';vehicles[0].model='Classe C 300 de Avantgarde com equipamento de demonstração';
  for(const width of [1440,900,390])for(const reducedMotion of ['no-preference','reduce']){
    const context=await browser.newContext({viewport:{width,height:950},isMobile:width===390,hasTouch:width===390,reducedMotion});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const stage=page.locator('.vehicle-photo-stage'),next=page.locator('.photo-next'),expand=page.getByRole('button',{name:'Abrir em ecrã inteiro',exact:true});
    const dialog=page.locator('dialog.gallery-dialog');
    try{
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.pathname.includes('/photos/')&&!url.pathname.endsWith('/access'))return route.fulfill({contentType:'image/png',headers:{'x-photo-version':String(Number(url.pathname.split('/').at(-1))+1).repeat(64)},body:photos[Number(url.pathname.split('/').at(-1))]??photos[0]});
        return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
      });
      await page.goto(`${origin}/viaturas/${vehicles[0].slug}`);
      await page.waitForFunction(()=>document.querySelector('.vehicle-photo .photo-rail-track')?.dataset.moving==='false'&&document.querySelector('.vehicle-photo .photo-rail-slide:not([inert]) img')?.naturalWidth>0);
      await stage.scrollIntoViewIfNeeded();
      const css=button=>button.evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return {opacity:Number(c.opacity),transition:c.transitionDuration,x:r.x,right:r.right,width:r.width,height:r.height,outline:c.outlineColor,pointer:c.pointerEvents};});
      assert.equal(await page.locator('.vehicle-photo .photo-rail-slide:not([inert]) button').evaluate(el=>getComputedStyle(el).cursor),'pointer');
      const expandBox=await expand.boundingBox();assert.ok(expandBox.width>=44&&expandBox.height>=44);
      await page.mouse.move(0,0);await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(320);
      if(width>700){
        assert.equal((await css(next)).opacity,0);
        await stage.hover();await page.waitForTimeout(320);assert.equal((await css(next)).opacity,1);
        const box=await stage.boundingBox(),arrow=await css(next);assert.equal(arrow.width,56);assert.ok(Math.abs(box.x+box.width-arrow.right-24)<1);
        await next.hover();await page.waitForTimeout(150);assert.equal((await css(next)).opacity,1,'image to button hover does not flicker');
        await page.mouse.move(0,0);await page.waitForTimeout(320);assert.equal((await css(next)).opacity,0);
        await page.keyboard.press('Tab');await next.focus();await page.waitForTimeout(320);assert.equal((await css(next)).opacity,1);assert.equal((await css(next)).outline,'rgb(255, 255, 255)');
      }else{assert.equal((await css(next)).opacity,1);assert.equal((await css(next)).width,48);}
      if(reducedMotion==='reduce')assert.equal((await css(next)).transition,'0s');
      await page.screenshot({path:`.svelte-kit/inline-gallery-${width}-${reducedMotion}.png`});
      await page.evaluate(()=>{
        window.openingFrames=[];
        const observer=new MutationObserver(()=>{
          const floating=document.querySelector('[data-opening-photo]');if(!floating)return;
          observer.disconnect();
          const record=()=>{if(!floating.isConnected)return;const box=floating.getBoundingClientRect(),canvas=floating.querySelector('canvas'),c=canvas.getBoundingClientRect();window.openingFrames.push({x:box.x,y:box.y,width:box.width,height:box.height,ratio:c.width/c.height,hidden:floating.getAttribute('aria-hidden')});requestAnimationFrame(record);};record();
        });observer.observe(document.querySelector('dialog.gallery-dialog'),{childList:true});
      });
      if(width===390)await expand.tap();else await expand.click();
      await dialog.waitFor({state:'visible'});await page.waitForTimeout(350);
      const frames=await page.evaluate(()=>window.openingFrames);
      if(reducedMotion==='reduce')assert.equal(frames.length,0);
      else{assert.ok(frames.length>=3,'opening expands continuously across multiple frames');for(const frame of frames){assert.equal(frame.hidden,'true');assert.ok(Math.abs(frame.ratio-4/3)<.005,'photo ratio is preserved');}}
      assert.equal(await dialog.locator('[data-opening-photo]').count(),0);
      for(const index of [0,1]){
        if(index){await dialog.getByRole('button',{name:'Ver fotografia 2',exact:true}).click();await page.waitForTimeout(450);}
        const geometry=await dialog.evaluate(root=>{
          const box=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          const image=root.querySelector('.photo-rail-slide:not([inert]) img'),r=image.getBoundingClientRect(),scale=Math.min(r.width/image.naturalWidth,r.height/image.naturalHeight);
          return {root:box(root),heading:box(root.querySelector('.viewer-heading')),frame:box(image),thumbs:box(root.querySelector('.viewer-thumbnails')),paintedArea:image.naturalWidth*image.naturalHeight*scale*scale,ratio:image.naturalWidth/image.naturalHeight,overflow:root.scrollHeight>root.clientHeight+1,fit:getComputedStyle(image).objectFit,backdrop:getComputedStyle(root,'::backdrop').backgroundColor};
        });
        assert.equal(geometry.fit,'contain');assert.equal(geometry.overflow,false);
        assert.ok(geometry.heading.bottom<=geometry.frame.top+1,'heading does not cover the photo');
        assert.ok(geometry.thumbs.top>=geometry.frame.bottom-1,'thumbnails do not cover the photo');
        assert.ok(geometry.root.bottom<=950&&geometry.thumbs.bottom<=950&&geometry.root.left>=0&&geometry.root.right<=width);
        const oldWidth=width<=700?width-24:Math.min(1960,width-64)-16-128;
        const oldHeight=width<=700?768:Math.min(1180,950-Math.max(40,Math.min(88,950*.07)))-16-31.5-64-20;
        const baselineWidth=Math.min(oldWidth,oldHeight*geometry.ratio),baselineArea=baselineWidth*baselineWidth/geometry.ratio;
        assert.ok(geometry.paintedArea>baselineArea*1.025,'the actual contained photo gains area over the previous layout');
        assert.ok(geometry.backdrop.includes('0.76'));
      }
      await page.screenshot({path:`.svelte-kit/fullscreen-gallery-${width}-${reducedMotion}.png`});
      await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
      // Repeated opening, immediate Escape and interaction during expansion clean up safely.
      for(let run=0;run<2;run++){await expand.click();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.locator('[data-opening-photo]').count(),0);}
      await expand.focus();await page.keyboard.press('Enter');await dialog.waitFor({state:'visible'});
      if(reducedMotion==='no-preference'){
        const portrait=dialog.locator('[data-opening-photo] canvas');
        assert.ok(Math.abs(await portrait.evaluate(canvas=>canvas.width/canvas.height)-.75)<.005,'reopening uses the currently selected portrait, not the first photo');
      }
      await dialog.locator('.viewer-next').click();assert.equal(await dialog.locator('[data-opening-photo]').count(),0);await page.waitForTimeout(450);
      assert.ok((await dialog.locator('.viewer-photo-position').textContent()).includes('3 / 3'));
      await dialog.locator('.dialog-close').click();
      await page.locator('.detail-thumbnails button').first().click();await page.waitForTimeout(450);
      await page.locator('.vehicle-photo .photo-rail-slide:not([inert]) button').click();await dialog.waitFor({state:'visible'});
      await page.setViewportSize({width:width+12,height:930});await page.waitForTimeout(50);assert.equal(await page.locator('[data-opening-photo]').count(),0);await page.keyboard.press('Escape');
      const sourceImage=page.locator('.vehicle-photo .photo-rail-slide:not([inert]) img');
      await sourceImage.evaluate(image=>image.style.visibility='hidden');await expand.click();await dialog.waitFor({state:'visible'});
      assert.equal(await dialog.locator('[data-opening-photo]').count(),0,'missing source uses the immediate functional fallback');
      await sourceImage.evaluate(image=>image.style.visibility='');await page.keyboard.press('Escape');
      assert.deepEqual(errors,[]);console.log(`PASS gallery presentation and opening ${width}px ${reducedMotion}`);
    }catch(error){console.error(logs.slice(-1800));await page.screenshot({path:`.svelte-kit/gallery-presentation-failure-${width}-${reducedMotion}.png`});throw error;}
    finally{await context.close();}
  }
}finally{await browser?.close();vite.kill();await new Promise(resolve=>backend.close(resolve));await rm(configPath,{force:true});}
