// Hydrate the real photo draft. Images and vehicle state are local fixtures.
// No vehicle is created and each page uses an isolated browser context.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
let directory, vite, server, browser, origin;
before(async () => {
  const cache = path.join(appRoot, '.svelte-kit');
  await mkdir(cache, { recursive: true });
  directory = await mkdtemp(path.join(cache, 'photo-gallery-browser-'));
  const write = (name, value) => writeFile(path.join(directory, name), value);
  await write('package.json', '{"type":"module"}');
  await write('review.css', "@import '../../src/app.css';\n@source '../../src';");
  await write(
    'App.svelte',
    `<script>
import {onMount} from 'svelte';
import VehiclePhotoDraft from '$review/VehiclePhotoDraft.svelte';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="gray"/></svg>');
let photos=$state(Array.from({length:12},(_,i)=>({path:'photo-'+i,url:image}))),selected=$state([]);
const persisted=photos.map(p=>p.path);
onMount(()=>{window.photoOrder=()=>photos.map(p=>p.path);window.allPhotos=()=>selected;});
</script>
<main style="max-width:1100px;margin:auto;padding-top:180px;padding-bottom:1600px">
<form id="photo-form"></form><VehiclePhotoDraft bind:photos bind:selected {persisted} persistedCoverPath="photo-0" published={true} form="photo-form"/>
</main>`,
  );
  await write(
    'Icon.svelte',
    '<script>let {size=16,class:className=""}=$props();</script><svg width={size} height={size} class={className} aria-hidden="true"></svg>',
  );
  await write(
    'icons.js',
    "export {default as Camera,default as Plus,default as Upload,default as X,default as Check,default as Star,default as Trash2,default as GripVertical} from './Icon.svelte';",
  );
  await write(
    'client.js',
    `import './review.css';import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app')});window.reviewReady=true;`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export function html(){return render(App).body;}`,
  );
  await write('navigation.js', 'export const goto=async()=>{};');
  await write('paths.js', "export const base='';");
  await write(
    'toast.js',
    'export const toast={success(){},error(message){window.validationToasts.push(message)}};',
  );
  await write(
    'enhance.js',
    `export function enhance(form,callback){const submit=async event=>{event.preventDefault();let cancelled=false;const complete=callback({formElement:form,cancel(){cancelled=true}});if(cancelled)return;window.validationSubmissions++;await complete?.({result:{type:'failure',data:window.validationFailure??{error:'Serviço temporariamente indisponível.'}},update:async()=>{}});};form.addEventListener('submit',submit);return {destroy(){form.removeEventListener('submit',submit);}};}`,
  );
  server = createHttpServer(async (request, response) => {
    if (request.url === '/') {
      try {
        const module = await vite.ssrLoadModule('/ssr.js');
        const html = await vite.transformIndexHtml(
          '/',
          `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app">${module.html()}</div><script type="module" src="/client.js"></script></body></html>`,
        );
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(html);
      } catch (error) {
        response.writeHead(500);
        response.end(String(error));
      }
    } else vite.middlewares(request, response);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  vite = await createServer({
    configFile: false,
    root: directory,
    plugins: [tailwindcss(), svelte({ configFile: false })],
    resolve: {
      alias: [
        { find: 'lucide-svelte', replacement: path.join(directory, 'icons.js') },
        { find: '$review', replacement: path.join(appRoot, 'src/lib/components/vehicle') },
        { find: '$lib/auth/enhance', replacement: path.join(directory, 'enhance.js') },
        { find: '$app/navigation', replacement: path.join(directory, 'navigation.js') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
        { find: 'svelte-sonner', replacement: path.join(directory, 'toast.js') },
        { find: '$lib', replacement: path.join(appRoot, 'src/lib') },
      ],
    },
    server: {
      hmr: { server, host: '127.0.0.1', clientPort: Number(new URL(origin).port) },
      middlewareMode: true,
      fs: {
        allow: [
          path.resolve(appRoot, '../..'),
          await realpath(path.resolve(appRoot, '../../node_modules')),
        ],
      },
    },
    optimizeDeps: { entries: ['client.js'] },
    logLevel: 'error',
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL }
      : {}),
  });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    directory &&
    path.dirname(directory) === path.join(appRoot, '.svelte-kit') &&
    path.basename(directory).startsWith('photo-gallery-browser-')
  )
    await rm(directory, { recursive: true, force: true });
});

for (const width of [1366, 390]) test('photo scroll and ordering at ' + width, {timeout: 90000}, async () => {
  const context = await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page = await context.newPage(), errors=[];
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});
  try {
    await page.route('**/*', route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin);
    await page.waitForFunction(()=>window.photoOrder && window.allPhotos().length===12);
    assert.equal(await page.getByRole('checkbox').count(),0);
    const wheel = async target => {
      await target.scrollIntoViewIfNeeded(); await target.hover();
      const before=await page.evaluate(()=>scrollY);
      await page.mouse.wheel(0,250);await page.waitForTimeout(300);
      assert.ok(await page.evaluate(()=>scrollY)>before,'page scrolls over '+await target.getAttribute('class'));
    };
    await wheel(page.locator('.photo-card img').first());
    await wheel(page.getByRole('button',{name:'Eliminar fotografia 3',exact:true}));
    await wheel(page.getByRole('button',{name:'Ordenar fotografia 2',exact:true}));
    const help=page.getByText('Como funciona a publicação?',{exact:true});
    await wheel(help);await help.click();await wheel(page.locator('.publication-help p'));await help.click();
    if(width===390){
      const image=page.locator('.photo-card img').first();await image.scrollIntoViewIfNeeded();
      const box=await image.boundingBox(), before=await page.evaluate(()=>scrollY), order=await page.evaluate(()=>window.photoOrder());
      const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*18}]});await page.waitForTimeout(25);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
      assert.ok(await page.evaluate(()=>scrollY)>before,'touch on image scrolls');
      assert.deepEqual(await page.evaluate(()=>window.photoOrder()),order);
    }
    const handle=page.getByRole('button',{name:'Ordenar fotografia 1',exact:true});
    await handle.scrollIntoViewIfNeeded();await handle.focus();
    await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await page.waitForTimeout(300);
    assert.deepEqual((await page.evaluate(()=>window.photoOrder())).slice(0,2),['photo-1','photo-0']);
    const first=page.getByRole('button',{name:'Ordenar fotografia 1',exact:true});await first.scrollIntoViewIfNeeded();
    const a=await first.boundingBox(),b=await page.locator('.photo-card').nth(1).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});await page.waitForTimeout(200);
    await page.mouse.up();await page.waitForTimeout(350);
    assert.equal((await page.evaluate(()=>window.photoOrder()))[0],'photo-0','mouse handle drag reorders');
    await page.getByRole('button',{name:'Definir fotografia 3 como principal',exact:true}).click();
    assert.equal((await page.evaluate(()=>window.photoOrder()))[0],'photo-2');
    assert.equal(await page.locator('.cover-preview img').getAttribute('alt'),'Foto principal · por guardar');
    await page.getByRole('button',{name:'Eliminar fotografia 2',exact:true}).click();
    assert.equal(await page.locator('.photo-card').count(),11);
    assert.equal((await page.evaluate(()=>window.allPhotos())).length,11);
    await page.locator('input[type=file]').setInputFiles({name:'added.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZsAAAAASUVORK5CYII=','base64')});
    await page.waitForFunction(()=>window.allPhotos().length===12);
    await page.waitForTimeout(500);
    const boxes=await page.locator('.photo-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=1,'photo cards must not overlap');}
    await page.screenshot({path:path.join(appRoot,'.svelte-kit','photo-rule-'+width+'.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  } catch(error) {console.error(error);console.error((await page.locator('body').innerText()).slice(0,1200));await page.screenshot({path:path.join(appRoot,'.svelte-kit','photo-failure-'+width+'.png')});throw error;} finally {await context.close();}
});
