// Hydrate the real photo draft. Images and vehicle state are local fixtures.
// No vehicle is created and each page uses an isolated browser context.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
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
  const shell = await readFile(path.join(appRoot,'src/routes/+layout.svelte'),'utf8');
  const toastStyles = shell.match(/<style>([\s\S]*?)<\/style>/)[1];
  await write(
    'App.svelte',
    `<script>
import {onMount} from 'svelte';
import VehiclePhotoDraft from '$review/VehiclePhotoDraft.svelte';
import {Toaster,toast} from 'svelte-sonner';
import {vehicleSavedFeedback} from '$review/vehicleSaveFeedback';
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="gray"/></svg>');
let currentTheme=$state('dark');
let photos=$state(Array.from({length:12},(_,i)=>({path:'photo-'+i,url:image}))),selected=$state([]);
const persisted=photos.map(p=>p.path);
onMount(()=>{window.setTheme=value=>{currentTheme=value;document.documentElement.dataset.theme=value;};window.photoOrder=()=>photos.map(p=>p.path);window.allPhotos=()=>selected;window.showSaved=(width,height)=>vehicleSavedFeedback({title:"Viatura adicionada ao CRM",brand:"Marca de demonstração",model:"ModeloComUmNomeMuitoCompridoSemEspaços".repeat(3),year:2026,detail:"A viatura e todas as fotografias foram guardadas com sucesso. ".repeat(3),photo:{url:"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="teal"/></svg>')}});window.dismissSaved=()=>toast.dismiss();});
</script>
<main style="max-width:1100px;margin:auto;padding-top:180px;padding-bottom:1600px">
<form id="photo-form"></form><VehiclePhotoDraft bind:photos bind:selected {persisted} persistedCoverPath="photo-0" form="photo-form"/>
</main><Toaster theme={currentTheme} position="bottom-right" closeButton richColors duration={4500} expand visibleToasts={5}/><style>${toastStyles}</style>`,
  );
  await write(
    'client.js',
    `import './review.css';import {hydrate} from 'svelte';import App from './App.svelte';hydrate(App,{target:document.querySelector('#app')});window.reviewReady=true;`,
  );
  await write(
    'ssr.js',
    `import {render} from 'svelte/server';import App from './App.svelte';export function html(){return render(App).body;}`,
  );
  await write('paths.js', "export const base='';");
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
    ssr: {noExternal:["svelte-sonner","lucide-svelte"]},
    resolve: {
      alias: [
        { find: '$review', replacement: path.join(appRoot, 'src/lib/components/vehicle') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
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

for (const width of [1366,390]) for (const theme of ['light','dark'])
test(`whole photo card drag, scroll and saved toast ${width}px ${theme}`,{timeout:90000},async()=>{
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));
  const cards=()=>page.locator('.photo-grid > .photo-card');
  try {
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.goto(origin);await page.waitForFunction(()=>window.allPhotos?.().length===12);
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    assert.equal(await page.locator('.drag-handle').count(),0);
    assert.equal(await page.getByRole('checkbox').count(),0);
    const wheel=async target=>{
      await target.scrollIntoViewIfNeeded();await target.hover();const before=await page.evaluate(()=>scrollY);
      await page.mouse.wheel(0,230);await page.waitForTimeout(250);
      assert.ok(await page.evaluate(()=>scrollY)>before,'wheel scrolls page over photo/control');
    };
    await wheel(cards().first().locator('img'));
    await wheel(page.getByRole('button',{name:'Eliminar fotografia 3',exact:true}));
    await wheel(cards().nth(1).locator('.photo-footer'));
    const help=page.getByText('Como funciona a publicação?',{exact:true});
    await wheel(help);await help.click();await wheel(page.locator('.publication-help p'));await help.click();
    if(width===390){
      const image=cards().first().locator('img');await image.scrollIntoViewIfNeeded();
      const box=await image.boundingBox(),before=await page.evaluate(()=>scrollY),order=await page.evaluate(()=>window.photoOrder());
      const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*18}]});await page.waitForTimeout(25);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
      assert.ok(await page.evaluate(()=>scrollY)>before,'touch swipe scrolls instead of dragging');
      assert.deepEqual(await page.evaluate(()=>window.photoOrder()),order);
    }
    await cards().first().scrollIntoViewIfNeeded();await cards().first().focus();
    await page.keyboard.press('Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await page.waitForTimeout(250);
    assert.deepEqual((await page.evaluate(()=>window.photoOrder())).slice(0,2),['photo-1','photo-0']);
    // Image and body both initiate drag. Sample the real clone while moving, not only after drop.
    for(const region of ['.photo-media img','.photo-footer']){
      await cards().first().scrollIntoViewIfNeeded();
      const original=await cards().first().boundingBox(),image=await cards().first().locator('.photo-media').boundingBox();
      const a=await cards().first().locator(region).boundingBox(),b=await cards().nth(1).boundingBox();if(region==='.photo-footer')a.height=8;
      const before=await page.evaluate(()=>window.photoOrder());
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
      await page.mouse.move(a.x+a.width/2+10,a.y+a.height/2,{steps:3});
      await page.locator('#dnd-action-dragged-el').waitFor();
      for(const fraction of [.4,.7,1]){
        await page.mouse.move(a.x+(b.x+b.width/2-a.x)*fraction,a.y+(b.y+b.height/2-a.y)*fraction,{steps:8});await page.waitForTimeout(180);
        const clone=await page.locator('#dnd-action-dragged-el').boundingBox(),media=await page.locator('#dnd-action-dragged-el .photo-media').boundingBox();
        assert.ok(Math.abs(clone.width-original.width)<1&&Math.abs(clone.height-original.height)<1,'drag clone keeps original dimensions');
        assert.ok(Math.abs(media.height-image.height)<1,'drag image keeps its frame');
      }
      await page.screenshot({path:path.join(appRoot,'.svelte-kit',`photo-drag-${width}-${theme}.png`)});
      await page.mouse.up();await page.waitForTimeout(350);
      assert.deepEqual((await page.evaluate(()=>window.photoOrder())).slice(0,2),[before[1],before[0]]);
    }
    if(width===390){
      // Deliberate long press starts whole-card touch drag, while the earlier quick swipe did not.
      await cards().first().scrollIntoViewIfNeeded();
      const a=await cards().first().locator('img').boundingBox(),b=await cards().nth(1).boundingBox();
      const before=await page.evaluate(()=>window.photoOrder()),cdp=await context.newCDPSession(page);
      const x=a.x+a.width/2,y=a.y+a.height/2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await page.waitForTimeout(420);
      await page.locator('#dnd-action-dragged-el').waitFor();
      for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(b.x+b.width/2-x)*i/10,y:y+(b.y+b.height/2-y)*i/10}]});await page.waitForTimeout(45);}
      await page.waitForTimeout(200);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);
      assert.deepEqual((await page.evaluate(()=>window.photoOrder())).slice(0,2),[before[1],before[0]]);
    }
    await page.getByRole('button',{name:'Definir fotografia 3 como principal',exact:true}).click();
    assert.equal((await page.evaluate(()=>window.photoOrder()))[0],'photo-2');
    await page.getByRole('button',{name:'Eliminar fotografia 2',exact:true}).click();assert.equal(await cards().count(),11);
    await page.locator('input[type=file]').setInputFiles({name:'added.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZsAAAAASUVORK5CYII=','base64')});
    await page.waitForFunction(()=>window.allPhotos().length===12);await page.waitForTimeout(400);
    const boxes=await cards().evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
    for(const a of boxes)assert.ok(a.height>a.width,'cards are taller than wide');
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.x,b.x)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)<=1,'cards do not overlap');}
    await cards().first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(appRoot,'.svelte-kit',`photo-cards-${width}-${theme}.png`)});
    for(const dimensions of [[4000,700],[700,4000]]){
      await page.evaluate(([w,h])=>window.showSaved(w,h),dimensions);
      await page.locator('.vehicle-success img').waitFor();await page.waitForTimeout(400);
      const bounds=await page.locator('.vehicle-success').evaluate(root=>{
        const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        return {root:box(root),frame:box(root.querySelector('.vehicle-image')),image:box(root.querySelector('img')),copy:box(root.querySelector('.copy'))};
      });
      for(const child of [bounds.image,bounds.frame,bounds.copy])assert.ok(child.x>=bounds.root.x&&child.right<=bounds.root.right+1&&child.y>=bounds.root.y&&child.bottom<=bounds.root.bottom+1,'toast image and text stay inside card '+JSON.stringify(bounds));
      assert.ok(bounds.image.right<=bounds.frame.right+1&&bounds.image.bottom<=bounds.frame.bottom+1,'image stays in thumbnail frame');
      assert.ok(bounds.root.right<=width&&bounds.root.x>=0,'toast stays inside viewport');
      await page.screenshot({path:path.join(appRoot,'.svelte-kit',`vehicle-toast-${width}-${theme}.png`)});
      if(width===1366&&theme==='light'&&dimensions[0]===700){await page.mouse.move(0,0);await page.locator('.vehicle-success').waitFor({state:'detached',timeout:8500});}
      else{await page.evaluate(()=>window.dismissSaved());await page.locator('.vehicle-success').waitFor({state:'detached'});}
    }
    assert.deepEqual(errors,[]);
  }catch(error){await page.screenshot({path:path.join(appRoot,'.svelte-kit',`photo-failure-${width}-${theme}.png`)});throw error;}
  finally{await context.close();}
});
