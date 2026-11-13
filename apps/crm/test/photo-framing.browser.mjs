// Isolated fixtures only. Retain generated fixtures/screenshots for inspection; no cleanup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from '@playwright/test';

test(
  'drag, keyboard, independent devices, reset, gallery selection and public crops',
  { timeout: 120000 },
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
    await write('environment.js', 'export const dev=true; export const browser=true; export const building=false;');
    await write('navigation.js','export const invalidateAll=async()=>{};export const goto=async()=>{};export const afterNavigate=()=>{};export const beforeNavigate=()=>{};');
    await write('stores.js',"import{writable}from'svelte/store';export const page=writable({url:new URL('http://fixture.test/viaturas'),data:{},params:{},state:{}});export const navigating=writable(null);");
    await write('state.js',"export const page={url:new URL('http://fixture.test/viaturas'),data:{}};");
    await write('public.js',"export const PUBLIC_BACKEND_URL='http://backend.fixture';");
    await write('review.css', "@import '../../src/app.css';\n@source '../../src';\n#public-card .stand-header{display:none!important}");
    await write(
      'App.svelte',
      `<script>
import Editor from '@crm/components/vehicle/PhotoFramingEditor.svelte';
import Picker from '@crm/components/vehicle/PublicPhotoPicker.svelte';
import Featured from '@website/components/stand-concepts/FeaturedPhoto.svelte';
import Rail from '@website/components/VehiclePhotoRail.svelte';
import Gallery from '@crm/components/vehicle/PhotoGallery.svelte';
import Design from '@website/components/stand-concepts/DesignEdition.svelte';
import {emptyStock,publicCard} from '@website/publicVehicles';
import '@website/components/stand-concepts/homeHeroDirections.css';
let src=$state(${JSON.stringify(src)});
window.setReviewPhoto = (next) => src = next;
const draftSrc=URL.createObjectURL(new Blob([${JSON.stringify(svg)}],{type:'image/svg+xml'}));
import {setContext} from 'svelte';
import {createFavorites,favoritesContext} from '@website/favorites';
import {createComparison,comparisonContext} from '@website/comparison';
import {createNotifications,notificationContext} from '@website/notifications';
import {createPublicTheme,publicThemeContext} from '@website/publicTheme';
const notifications=createNotifications();setContext(notificationContext,notifications);setContext(favoritesContext,createFavorites(notifications.push));setContext(comparisonContext,createComparison(notifications.push));setContext(publicThemeContext,createPublicTheme(true));
const session={attach(){},detach(){},hasCopy(){return true;},async read(){return {url:src};}};
let value=$state(), framing=$state(JSON.parse(localStorage.getItem('framing-fixture')||'{}')), selected=$state(['a','b','draft:new']);
const vehicle=$derived({year:2026,fuel:'DIESEL',mileage:100,price:'1000.00',currency:'EUR',description:null,transmission:null,availability:'AVAILABLE',slug:'fixture-123456abcdef',brand:'Teste',model:'Vertical',photos:['/api/public/vehicles/fixture-123456abcdef/photos/0'],galleryFraming:[value]});
const cardVehicle=$derived({...vehicle,galleryFraming:[framing[selected[0]]??null]});
const stock=$derived({...emptyStock('ready'),catalog:{...emptyStock('ready').catalog,items:[cardVehicle],total:1}});
</script>
<main style="max-width:900px;margin:auto;padding:20px">
<Editor {src} {value} context="gallery" onchange={next=>value=next}/>
<output id="value">{JSON.stringify(value??null)}</output>
<Picker bind:selected allowed={['a','b','draft:new']} persisted={['a','b']} staged photos={[{path:'a',url:src},{path:'b',url:src},{path:'draft:new',url:draftSrc}]} {framing} onframing={(path,value)=>framing={...framing,[path]:value}}/>
<button type="button" onclick={()=>localStorage.setItem('framing-fixture',JSON.stringify(framing))}>Guardar ficha</button>
<output id="gallery">{JSON.stringify(framing)}</output><button onclick={()=>selected=['b','a','draft:new']}>Trocar principal</button><button onclick={()=>selected=['a','b','draft:new']}>Repor principal</button>
<div id="crm-gallery"><Gallery vehicleId="fixture" photos={[{path:'a',url:src},{path:'b',url:src}]} {framing} editable={false}/></div>
<section class="hd-root hd-1"><div class="hd-photo" style="width:100%;height:300px"><Featured source={src} framing={value} alt="Destaque" onfailure={()=>{}} ondisplay={()=>{}}/></div></section>
<div id="inline" style="height:300px"><Rail {vehicle} index={0} onContact={()=>{}}/></div>
<div id="full" style="height:300px"><Rail {vehicle} {session} index={0} fullscreen onContact={()=>{}}/></div>
</main><div id="public-card"><Design catalog {stock}>{#snippet routeContent({card})}<div style="width:min(380px,100%)">{@render card(publicCard(cardVehicle),0,false)}</div>{/snippet}</Design></div>`,
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
            { find: '$app/environment', replacement: path.join(directory, 'environment.js') },
            { find: '@crm', replacement: path.join(root, 'apps/crm/src/lib') },
            { find: '@website', replacement: path.join(root, 'apps/website/src/lib') },
            {find:'$app/stores',replacement:path.join(directory,'stores.js')},{find:'$app/state',replacement:path.join(directory,'state.js')},{find:'$env/static/public',replacement:path.join(directory,'public.js')},
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
      if (process.env.FRAMING_REVIEW_PHOTO) {
        const reviewPage = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
        await reviewPage.goto(origin);
        const reviewEditor = reviewPage.locator('.framing').first();
        const real = await readFile(process.env.FRAMING_REVIEW_PHOTO);
        await reviewPage.evaluate(data => window.setReviewPhoto(data), 'data:image/jpeg;base64,' + real.toString('base64'));
        await reviewEditor.locator('img').evaluate(img => img.decode());
        await reviewEditor.getByRole('button', { name: 'Foto inteira', exact: true }).click();
        await reviewEditor.screenshot({ path: path.join(output, 'photo-framing-real-1280.png') });
        await reviewPage.setViewportSize({ width: 390, height: 1000 });
        await reviewEditor.getByRole('button', { name: 'Telemóvel', exact: true }).click();
        await reviewEditor.getByRole('button', { name: 'Foto inteira', exact: true }).click();
        await reviewEditor.screenshot({ path: path.join(output, 'photo-framing-real-390.png') });
        await reviewPage.getByRole('button', { name: 'Enquadrar', exact: true }).first().click();
        const galleryReview = reviewPage.locator('.framing-editor');
        assert.equal(await galleryReview.locator('.framing').count(), 1);
        await galleryReview.getByRole('button', { name: 'Foto inteira', exact: true }).click();
        for (const reviewWidth of [1280, 390]) {
          await reviewPage.setViewportSize({ width: reviewWidth, height: 1100 });
          await galleryReview.getByRole('button', { name: reviewWidth === 390 ? 'Telemóvel' : 'Computador', exact: true }).click();
          await galleryReview.getByRole('button', { name: 'Foto inteira', exact: true }).click();
          for (const theme of ['dark', 'light']) {
            await reviewPage.evaluate(value => document.documentElement.dataset.theme = value, theme);
            await galleryReview.screenshot({ animations: 'disabled', path: path.join(output, `photo-framing-gallery-${reviewWidth}-${theme}.png`) });
            await galleryReview.getByRole('button', { name: 'Imagem na galeria', exact: true }).hover();
            await galleryReview.screenshot({ animations: 'disabled', path: path.join(output, `photo-framing-gallery-${reviewWidth}-${theme}-hover.png`) });
            await reviewPage.mouse.move(0, 0);
          }
        }
        await reviewPage.close();
      }
      for (const width of [1280, 390]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 } }),
          errors = [];
        page.on('pageerror', (error) => {errors.push(error.message);console.error('Fixture page error:',error.message);});
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
        assert.equal(await editor.locator('input[type=range]').count(), 1);
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
        const gallery = page.locator('.framing-editor'),detail=gallery.getByRole('region',{name:'Enquadramento da imagem na galeria'}),cardFrame=gallery.getByRole('region',{name:'Enquadramento do cartão'});
        assert.equal(await gallery.locator('.framing').count(), 1, 'one destination editor is visible');
        assert.equal(await cardFrame.count(), 1, 'the principal photo opens on its card framing');
        await gallery.getByRole('group', { name: 'Destino do enquadramento' }).getByRole('button', { name: 'Imagem na galeria', exact: true }).click();
        const card=page.locator('.photo-card').first().locator('.photo-media img');
        const cardPosition=()=>card.evaluate(img=>getComputedStyle(img).objectPosition);
        const shownSource = (image) => image.evaluate(async (img) => {
          await img.decode();
          if (!img.naturalWidth) throw new Error('The photo is not visible');
          return img.currentSrc;
        });
        const cardSource = await shownSource(card);
        assert.equal(await cardPosition(),'50% 50%');
        const ratio=await page.locator('.photo-media').first().evaluate(node=>node.clientWidth/node.clientHeight);
        assert.ok(Math.abs(ratio-(width===390?4/3:1.4))<.025);
        assert.equal(await card.evaluate(img=>getComputedStyle(img).objectFit),'cover');
        if(width===390)await detail.getByRole('button',{name:'Telemóvel',exact:true}).click();
        await detail.getByRole('slider', { name: 'Posição da fotografia' }).focus();
        await page.keyboard.press('End');
        assert.equal(await cardPosition(),'50% 100%','card follows the open editor before applying');
        await gallery.getByRole('button',{name:'Cancelar',exact:true}).click();
        assert.equal(await cardPosition(),'50% 50%','cancel restores the previous card crop');
        await page.getByRole('button', { name: 'Enquadrar', exact: true }).first().click();
        await gallery.getByRole('group', { name: 'Destino do enquadramento' }).getByRole('button', { name: 'Imagem na galeria', exact: true }).click();
        if(width===390)await detail.getByRole('button',{name:'Telemóvel',exact:true}).click();
        await detail.getByRole('slider', { name: 'Posição da fotografia' }).focus();await page.keyboard.press('End');
        await gallery.getByRole('button', { name: 'Aplicar enquadramento' }).click();
        assert.equal(JSON.parse(await page.locator('#gallery').textContent()).a[width===390?'mobile':'desktop'].y, 100);
        assert.equal(JSON.parse(await page.locator('#gallery').textContent()).b, undefined);
        assert.equal(await cardPosition(),'50% 100%');
        assert.equal(await shownSource(card), cardSource, 'applying the crop keeps the decoded photo');
        await page.getByRole('button', { name: 'Enquadrar', exact: true }).first().click();
        assert.equal(await cardFrame.count(),1);
        if(width===390)await cardFrame.getByRole('button',{name:'Telemóvel',exact:true}).click();
        const cardPreview=cardFrame.locator('.preview');const size=await cardPreview.boundingBox();assert.ok(Math.abs(size.height-(size.width/1.4+60))<1);
        const detailBefore=JSON.parse(await page.locator('#gallery').textContent()).a;
        await cardFrame.getByRole('slider',{name:'Posição da fotografia'}).focus();await page.keyboard.press('Home');
        await gallery.getByRole('button', {name:'Aplicar enquadramento'}).click();
        const both=JSON.parse(await page.locator('#gallery').textContent()).a;assert.equal(both.card[width===390?'mobile':'desktop'].y,0);assert.equal(both[width===390?'mobile':'desktop'].y,detailBefore[width===390?'mobile':'desktop'].y);
        assert.equal(await shownSource(card), cardSource, 'applying another crop keeps the same photo');
        const publicCard=page.locator('#public-card .public-card .card-image').first();await publicCard.locator('img').waitFor();assert.equal(await publicCard.locator('img').evaluate(img=>getComputedStyle(img).objectPosition),'50% 0%');
        const publicSize=await publicCard.boundingBox();
        const photoExtra = await publicCard.evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue('--vehicle-card-photo-extra')));
        assert.ok(Math.abs(publicSize.height-(publicSize.width/1.4+photoExtra))<1);
        await page.getByRole('button',{name:'Trocar principal',exact:true}).click();
        await page.getByRole('button',{name:'Enquadrar',exact:true}).first().click();assert.equal(await cardFrame.count(),0);await gallery.getByRole('button',{name:'Cancelar',exact:true}).click();
        assert.equal(JSON.parse(await page.locator('#gallery').textContent()).a.card[width===390?'mobile':'desktop'].y,0);
        assert.equal(await publicCard.locator('img').evaluate(img=>getComputedStyle(img).objectPosition),'50% 50%');
        await page.getByRole('button',{name:'Repor principal',exact:true}).click();assert.equal(await publicCard.locator('img').evaluate(img=>getComputedStyle(img).objectPosition),'50% 0%');
        await page.getByRole('button', { name: 'Enquadrar', exact: true }).nth(2).click();
        const draftCard = page.locator('.photo-card').nth(2).locator('.photo-media img');
        const draftSource = await shownSource(draftCard);
        if(width===390)await detail.getByRole('button',{name:'Telemóvel',exact:true}).click();
        await detail.getByRole('slider', { name: 'Posição da fotografia' }).focus();await page.keyboard.press('End');
        await gallery.getByRole('button', { name: 'Aplicar enquadramento' }).click();
        assert.equal(await shownSource(draftCard), draftSource, 'applying a crop preserves the local blob');
        await page.getByRole('button',{name:'Guardar ficha',exact:true}).click();await page.reload();
        await page.locator('.photo-card').first().waitFor();
        assert.equal(await cardPosition(),'50% 100%','existing crop reopens from saved state');assert.equal(await publicCard.locator('img').evaluate(img=>getComputedStyle(img).objectPosition),'50% 0%','card crop reopens independently from the detail crop');
        const crmImage=page.locator('#crm-gallery .photo-preview .photo-slide[aria-hidden="false"] img');
        assert.equal(await crmImage.evaluate(img=>getComputedStyle(img).objectPosition),'50% 100%');
        const crmRatio=await page.locator('#crm-gallery .photo-preview').evaluate(node=>node.clientWidth/node.clientHeight);
        assert.ok(Math.abs(crmRatio-(width===390?4/3:1.4))<.025);
        await page.locator('#crm-gallery .photo-open').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await crmImage.evaluate(img=>getComputedStyle(img).objectPosition),'50% 50%','each consultation photo uses its own crop');
        await page.locator('#crm-gallery .photo-track[data-moving="true"]').waitFor({ state: 'hidden' });
        await page.locator('#crm-gallery .photo-open').click();
        const fullImage = page.locator(width === 390 ? '.crm-photo-viewer .photo-slide[aria-hidden="false"] img' : '.crm-photo-viewer > img');
        assert.equal(await fullImage.evaluate(img=>getComputedStyle(img).objectFit),'contain');
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
        await editor.getByRole('button', { name: 'Computador', exact: true }).click();
        const originalBox = await preview.boundingBox();
        await editor.getByRole('button', { name: 'Foto inteira', exact: true }).click();
        assert.equal(await preview.locator('img').evaluate(img => getComputedStyle(img).objectFit), 'contain');
        assert.equal(await preview.locator('[data-photo-backdrop]').count(), 1);
        await preview.focus();
        await page.keyboard.press('ArrowLeft');
        assert.equal(JSON.parse(await page.locator('#value').textContent()).desktop.x, 50);
        assert.equal(await preview.locator('img').evaluate(img => getComputedStyle(img).objectPosition), '50% 50%');
        assert.equal(await page.locator('section[aria-label="Enquadramento da oferta"]').count(), 0);
        await editor.getByRole('slider', { name: 'Zoom', exact: false }).fill('1.5');
        await editor.getByRole('button', { name: 'Preencher', exact: true }).click();
        await preview.focus();
        await page.keyboard.press('Shift+ArrowRight');
        const adjusted = JSON.parse(await page.locator('#value').textContent());
        assert.equal(adjusted.desktop.zoom, 1.5);
        assert.equal(adjusted.desktop.x, 40);
        assert.equal(adjusted.mobile.zoom, undefined);
        assert.equal(await preview.locator('img').evaluate(img => getComputedStyle(img).transform), 'matrix(1.5, 0, 0, 1.5, 0, 0)');
        assert.equal((await preview.boundingBox()).height, originalBox.height);
        await editor.getByRole('button', { name: 'Repor original' }).click();
        assert.equal(await preview.locator('img').evaluate(img => getComputedStyle(img).objectFit), 'cover');
        assert.equal(await preview.locator('[data-photo-backdrop]').count(), 0);
        assert.equal(await preview.locator('img').evaluate(img => getComputedStyle(img).transform), 'none');
        await page.evaluate(() => window.setReviewPhoto('data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#708478"/></svg>')));
        await page.waitForFunction(() => document.querySelector('.framing img')?.naturalWidth === 1200);
        for (const deviceName of ['Computador', 'Telemóvel']) {
          await editor.getByRole('button', { name: deviceName, exact: true }).click();
          await editor.getByRole('button', { name: 'Foto inteira', exact: true }).click();
          for (const zoom of ['1', '2']) {
            await editor.getByRole('slider', { name: 'Zoom', exact: true }).fill(zoom);
            await preview.focus();
            await page.keyboard.press('End');
            const area = await preview.boundingBox();
            await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
            await page.mouse.down();
            await page.mouse.move(area.x + area.width / 2 + 30, area.y + area.height / 2 + 40, { steps: 4 });
            await page.mouse.up();
            const device = deviceName === 'Computador' ? 'desktop' : 'mobile';
            assert.equal(JSON.parse(await page.locator('#value').textContent())[device].y, 50);
            assert.equal((await preview.locator('img').evaluate(img => getComputedStyle(img).objectPosition)).split(' ')[1], '50%');
          }
          await preview.focus();
          const beforeX = JSON.parse(await page.locator('#value').textContent())[deviceName === 'Computador' ? 'desktop' : 'mobile'].x;
          await page.keyboard.press('ArrowLeft');
          assert.notEqual(JSON.parse(await page.locator('#value').textContent())[deviceName === 'Computador' ? 'desktop' : 'mobile'].x, beforeX);
        }
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
