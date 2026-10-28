// Local fixtures only; does not contact or change the live backend.
// Run from apps/website: node test/galleryControls.browser.mjs
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
const configPath=path.resolve('.svelte-kit/gallery-controls-vite.config.mjs');
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
  for(const width of [1440,390])for(const reducedMotion of ['no-preference','reduce']){
    const context=await browser.newContext({viewport:{width,height:950},isMobile:width===390,hasTouch:width===390,reducedMotion});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});page.setDefaultTimeout(15000);
    try{
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.pathname.includes('/photos/')&&!url.pathname.endsWith('/access'))return route.fulfill({contentType:'image/png',headers:{'x-photo-version':String(Number(url.pathname.split('/').at(-1))+1).repeat(64)},body:photos[Number(url.pathname.split('/').at(-1))]??photos[0]});
        if(!['127.0.0.1','localhost'].includes(url.hostname))return route.abort();return route.continue();
      });
      await page.goto(`${origin}/viaturas/${vehicles[0].slug}`);
      const opener=page.locator('.vehicle-photo .photo-rail-slide:not([inert]) button');await opener.waitFor();await page.waitForFunction(()=>{const image=document.querySelector('.vehicle-photo .photo-rail-slide:not([inert]) img');return image?.naturalWidth>0&&getComputedStyle(image).visibility!=='hidden';});await page.waitForFunction(()=>document.querySelector('.vehicle-photo .photo-rail-track')?.dataset.moving==='false');await opener.click();
      const dialog=page.locator('dialog.gallery-dialog');await dialog.waitFor({state:'visible'});
      const style=async target=>target.evaluate(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,border:c.borderColor,color:c.color,opacity:c.opacity,shadow:c.boxShadow,outline:c.outlineColor,outlineStyle:c.outlineStyle,transition:c.transitionDuration};});
      const neutral=css=>{for(const value of [css.background,css.border,css.color,css.outline]){const n=value.match(/[\d.]+/g)?.map(Number);if(n?.length>=3)assert.ok(!(n[0]>n[1]*1.6&&n[0]>n[2]*1.6&&n[0]>100),'no red control color '+value);}};
      const previous=dialog.getByRole('button',{name:'Fotografia anterior',exact:true}),next=dialog.getByRole('button',{name:'Fotografia seguinte',exact:true}),close=dialog.getByRole('button',{name:'Fechar fotografia',exact:true});
      assert.equal(await previous.getAttribute('aria-disabled'),'true');
      await page.mouse.move(0,0);const disabled=await style(previous);await previous.hover();await page.waitForTimeout(200);assert.equal((await style(previous)).background,disabled.background);
      for(const control of [next,close]){
        await page.mouse.move(0,0);await page.waitForTimeout(200);const base=await style(control);
        await control.hover();await page.waitForTimeout(200);const hover=await style(control);neutral(hover);
        if(width>700)assert.notEqual(hover.background,base.background,'visible neutral hover');
        const bounds=await control.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44);
        if(reducedMotion==='reduce')assert.equal(hover.transition,'0s');
      }
      await next.hover();await page.mouse.down();const active=await style(next);neutral(active);await page.mouse.up();
      assert.equal(await previous.getAttribute('aria-disabled'),'false');
      await previous.hover();await page.waitForTimeout(180);neutral(await style(previous));
      const thumb=dialog.getByRole('button',{name:'Ver fotografia 1',exact:true});await thumb.hover();await page.waitForTimeout(180);neutral(await style(thumb));
      if(width>700)assert.equal((await style(thumb)).opacity,'1');
      await page.keyboard.press('Tab');const focused=page.locator('dialog.gallery-dialog button:focus-visible');assert.ok(await focused.count()>0);assert.equal((await style(focused.first())).outline,'rgb(255, 255, 255)');
      await close.hover();await page.waitForTimeout(180);await page.screenshot({path:`.svelte-kit/gallery-controls-${width}-${reducedMotion}.png`});
      await dialog.locator('.viewer-contact-thumbnail').click();
      const contact=dialog.getByRole('button',{name:/Falar connosco/});await contact.waitFor();await contact.hover();await page.waitForTimeout(220);neutral(await style(contact));
      await contact.click();assert.equal(await dialog.isVisible(),false);assert.equal(await page.locator('.contact-dialog').isVisible(),true);
      assert.deepEqual(errors,[]);console.log(`PASS fullscreen controls ${width}px ${reducedMotion}`);
    }catch(error){console.error(errors);console.error(logs.slice(-3000));await page.screenshot({path:'.svelte-kit/gallery-control-failure.png'});throw error;}finally{await context.close();}
  }
} finally {
  await browser?.close();vite.kill();await new Promise(resolve=>backend.close(resolve));await rm(configPath,{force:true});
}
