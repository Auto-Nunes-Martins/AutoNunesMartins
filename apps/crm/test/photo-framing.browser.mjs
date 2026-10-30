// Isolated fixtures only. Retain generated fixtures/screenshots for inspection; no cleanup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

test(
  'drag, keyboard, independent devices, reset, gallery selection and public crops',
  { timeout: 90000 },
  async () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const output = path.join(root, 'apps/crm/.svelte-kit');
    await mkdir(output, { recursive: true });
    const directory = await mkdtemp(path.join(output, 'photo-framing-'));
    const write = (name, content) => writeFile(path.join(directory, name), content);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200"><rect width="600" height="1200" fill="#708478"/><path d="M0 850h600" stroke="#e8dec0" stroke-width="180"/><rect x="90" y="780" width="420" height="130" rx="35" fill="#a23136"/><circle cx="170" cy="910" r="40"/><circle cx="440" cy="910" r="40"/></svg>';
    const src = 'data:image/svg+xml,' + encodeURIComponent(svg);
    await write('package.json', '{"type":"module"}');
    await write('paths.js', "export const base='';");
    await write('navigation.js','export const invalidateAll=async()=>{};');
    await write('review.css', "@import '../../src/app.css';\n@source '../../src';");
    await write(
      'App.svelte',
      `<script>
import Editor from '@crm/components/vehicle/PhotoFramingEditor.svelte';
import Picker from '@crm/components/vehicle/PublicPhotoPicker.svelte';
import Featured from '@website/components/stand-concepts/FeaturedPhoto.svelte';
import Rail from '@website/components/VehiclePhotoRail.svelte';
import Gallery from '@crm/components/vehicle/PhotoGallery.svelte';
import '@website/components/stand-concepts/homeHeroDirections.css';
const src=${JSON.stringify(src)};
const session={attach(){},detach(){},hasCopy(){return true;},async read(){return {url:src};}};
let value=$state(), framing=$state(JSON.parse(localStorage.getItem('framing-fixture')||'{}')), selected=$state(['a','b','draft:new']);
const vehicle=$derived({slug:'fixture-123456abcdef',brand:'Teste',model:'Vertical',photos:['/api/public/vehicles/fixture-123456abcdef/photos/0'],galleryFraming:[value]});
</script>
<main style="max-width:900px;margin:auto;padding:20px">
<Editor {src} {value} context="gallery" onchange={next=>value=next}/>
<output id="value">{JSON.stringify(value??null)}</output>
<Picker bind:selected allowed={['a','b','draft:new']} persisted={['a','b']} staged photos={[{path:'a',url:src},{path:'b',url:src},{path:'draft:new',url:src}]} {framing} onframing={(path,value)=>framing={...framing,[path]:value}}/>
<button type="button" onclick={()=>localStorage.setItem('framing-fixture',JSON.stringify(framing))}>Guardar ficha</button>
<output id="gallery">{JSON.stringify(framing)}</output>
<div id="crm-gallery"><Gallery vehicleId="fixture" photos={[{path:'a',url:src},{path:'b',url:src}]} {framing} editable={false}/></div>
<section class="hd-root hd-1"><div class="hd-photo" style="width:100%;height:300px"><Featured source={src} framing={value} alt="Destaque" onfailure={()=>{}} ondisplay={()=>{}}/></div></section>
<div id="inline" style="height:300px"><Rail {vehicle} index={0} onContact={()=>{}}/></div>
<div id="full" style="height:300px"><Rail {vehicle} {session} index={0} fullscreen onContact={()=>{}}/></div>
</main>`,
    );
    await write(
      'client.js',
      "import './review.css';import {mount} from 'svelte';import App from './App.svelte';mount(App,{target:document.querySelector('#app')});",
    );
    await write(
      'index.html',
      '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="app"></div><script type="module" src="/client.js"></script></body></html>',
    );
    let vite, browser;
    try {
      vite = await createServer({
        configFile: false,
        root: directory,
        plugins: [
          tailwindcss(),
          svelte({ configFile: false }),
          {
            name: 'fixture-libs',
            async resolveId(id, importer) {
              if (id.startsWith('$lib/')) {
                const app = importer?.replaceAll('\\', '/').includes('/apps/website/')
                  ? 'website'
                  : 'crm';
                return this.resolve(
                  path.join(root, 'apps', app, 'src/lib', id.slice(5)),
                  importer,
                  { skipSelf: true },
                );
              }
            },
          },
        ],
        resolve: {
          alias: [
            { find: '@crm', replacement: path.join(root, 'apps/crm/src/lib') },
            { find: '@website', replacement: path.join(root, 'apps/website/src/lib') },
            { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
            { find: '$app/navigation', replacement: path.join(directory, 'navigation.js') },
          ],
        },
        server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
        logLevel: 'error',
      });
      await vite.listen();
      const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
      browser = await chromium.launch({
        headless: true,
        channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined,
      });
      for (const width of [1280, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } }),
          errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/viaturas/**/photos/**', (route) =>
          route.fulfill({ contentType: 'image/svg+xml', body: svg }),
        );
        await page.goto(origin);
        const editor = page.locator('.framing').first(),
          preview = editor.locator('.preview');
        await preview.locator('img').evaluate((img) => img.decode());
        const position = () =>
          preview.locator('img').evaluate((img) => getComputedStyle(img).objectPosition);
        assert.equal(await position(), '50% 50%');
        const box = await preview.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 8 });
        await page.mouse.up();
        let value = JSON.parse(await page.locator('#value').textContent());
        assert.ok(value.desktop.y > 50);
        assert.equal(value.mobile.y, 50);
        await editor.getByRole('button', { name: 'Telemóvel', exact: true }).click();
        assert.equal(await position(), '50% 50%');
        assert.equal(await editor.locator('input[type=range]').count(), 0);
        await editor.getByRole('slider', { name: 'Posição da fotografia' }).focus();
        await page.keyboard.press('End');
        value = JSON.parse(await page.locator('#value').textContent());
        assert.equal(value.mobile.y, 100);
        assert.ok(value.desktop.y > 50);
        assert.equal(
          await page
            .locator('#inline img')
            .first()
            .evaluate((img) => getComputedStyle(img).objectPosition),
          width === 390 ? '50% 100%' : `50% ${value.desktop.y}%`,
        );
        assert.equal(
          await page
            .locator('#full img')
            .first()
            .evaluate((img) => getComputedStyle(img).objectFit),
          'contain',
        );
        assert.equal(
          await page
            .locator('#full img')
            .first()
            .evaluate((img) => img.naturalHeight),
          1200,
        );
        assert.equal(
          await page
            .locator('#full img')
            .first()
            .evaluate((img) => getComputedStyle(img).objectPosition),
          '50% 50%',
        );
        assert.equal(
          await page
            .locator('.hd-photo img')
            .evaluate((img) => getComputedStyle(img).objectPosition),
          width === 390 ? '50% 100%' : `50% ${value.desktop.y}%`,
        );
        await page.getByRole('button', { name: 'Enquadrar', exact: true }).first().click();
        const gallery = page.locator('.framing-editor');
        const card=page.locator('.photo-card').first().locator('.photo-media img');
        const cardPosition=()=>card.evaluate(img=>getComputedStyle(img).objectPosition);
        assert.equal(await cardPosition(),'50% 50%');
        const ratio=await page.locator('.photo-media').first().evaluate(node=>node.clientWidth/node.clientHeight);
        assert.ok(Math.abs(ratio-(width===390?4/3:1.4))<.025);
        assert.equal(await card.evaluate(img=>getComputedStyle(img).objectFit),'cover');
        if(width===390)await gallery.getByRole('button',{name:'Telemóvel',exact:true}).click();
        await gallery.getByRole('slider', { name: 'Posição da fotografia' }).focus();
        await page.keyboard.press('End');
        assert.equal(await cardPosition(),'50% 100%','card follows the open editor before applying');
        await gallery.getByRole('button',{name:'Cancelar',exact:true}).click();
        assert.equal(await cardPosition(),'50% 50%','cancel restores the previous card crop');
        await page.getByRole('button', { name: 'Enquadrar', exact: true }).first().click();
        if(width===390)await gallery.getByRole('button',{name:'Telemóvel',exact:true}).click();
        await gallery.getByRole('slider', { name: 'Posição da fotografia' }).focus();await page.keyboard.press('End');
        await gallery.getByRole('button', { name: 'Aplicar enquadramento' }).click();
        assert.equal(JSON.parse(await page.locator('#gallery').textContent()).a[width===390?'mobile':'desktop'].y, 100);
        assert.equal(JSON.parse(await page.locator('#gallery').textContent()).b, undefined);
        assert.equal(await cardPosition(),'50% 100%');
        await page.getByRole('button', { name: 'Enquadrar', exact: true }).nth(2).click();
        if(width===390)await gallery.getByRole('button',{name:'Telemóvel',exact:true}).click();
        await gallery.getByRole('slider', { name: 'Posição da fotografia' }).focus();await page.keyboard.press('End');
        await gallery.getByRole('button', { name: 'Aplicar enquadramento' }).click();
        await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();await page.reload();
        await page.locator('.photo-card').first().waitFor();
        assert.equal(await cardPosition(),'50% 100%','existing crop reopens from saved state');
        const crmImage=page.locator('#crm-gallery .photo-preview img');
        assert.equal(await crmImage.evaluate(img=>getComputedStyle(img).objectPosition),'50% 100%');
        const crmRatio=await page.locator('#crm-gallery .photo-preview').evaluate(node=>node.clientWidth/node.clientHeight);
        assert.ok(Math.abs(crmRatio-(width===390?4/3:1.4))<.025);
        await page.locator('#crm-gallery').getByRole('button',{name:'Fotografia seguinte',exact:true}).click();
        assert.equal(await crmImage.evaluate(img=>getComputedStyle(img).objectPosition),'50% 50%','each consultation photo uses its own crop');
        await page.locator('#crm-gallery .photo-open').click();
        assert.equal(await page.locator('.crm-photo-viewer > img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
        await page.locator('.crm-photo-viewer').getByRole('button',{name:'Fechar fotografia',exact:true}).click();
        assert.equal(await page.locator('.photo-card').nth(2).locator('.photo-media img').evaluate(img=>getComputedStyle(img).objectPosition),'50% 100%','new draft photo reopens with its own crop');
        await editor.getByRole('button', { name: 'Repor original' }).click();
        assert.equal(await page.locator('#value').textContent(), 'null');
        assert.equal(
          await page
            .locator('.hd-photo img')
            .evaluate((img) => getComputedStyle(img).objectPosition),
          '50% 53%',
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await page.screenshot({
          path: path.join(output, `photo-framing-${width}.png`),
          fullPage: true,
        });
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser?.close();
      await vite?.close();
    }
  },
);
