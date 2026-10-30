// Controlled local browser experiment. No production service or credentials.
// node scripts/measure-card-photo-delivery.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';

const root = process.cwd(), site = path.join(root, 'apps/website');
const out = path.join(root, process.env.PHOTO_MEASUREMENT_DIR || 'docs/measurements/responsive-reuse-2026-10-30/current');
const screenshots = path.join(site, '.svelte-kit/card-photo-measurements');
await mkdir(out, { recursive: true });
await mkdir(screenshots, { recursive: true });
const widths = [320, 384, 800, 1280, 1600, 2560];
const paths = ['home-v5/curves-wide-3840.webp', 'cabin/interior-crop-1920.webp', 'home-v5/forest-wide-3840.webp'];
const sources = await Promise.all(paths.map(p => readFile(path.join(site, 'src/lib/assets/optimized', p))));
const metadata = await Promise.all(sources.map(s => sharp(s).metadata()));
const versions = sources.map(s => createHash('sha256').update(s).digest('hex'));
const variants = await Promise.all(sources.map(async s => new Map(await Promise.all(widths.map(async w => [w,
  await sharp(s).resize({ width: w, withoutEnlargement: true }).webp({ quality: 84, effort: 6, smartSubsample: true }).toBuffer(),
])))));
const items = Array.from({ length: 6 }, (_, i) => {
  const slug = `measure-${i}-abcdef123456`;
  return { slug, brand: 'Teste', model: `Modelo ${i + 1}`, year: 2023, fuel: 'DIESEL', mileage: 20000,
    price: '21000.00', currency: 'EUR', description: 'Fixture local.', transmission: 'MANUAL', availability: 'AVAILABLE',
    photos: versions.map((v, n) => `/api/public/vehicles/${slug}/photos/${n}?v=${v}`),
    coverPhotoDimensions: { version: versions[0], width: metadata[0].width, height: metadata[0].height },photoDimensions:metadata.map((m,i)=>({version:versions[i],width:m.width,height:m.height})) };
});
const catalog = { items, total: 6, page: 1, pageSize: 30, totalPages: 1, facets: {
  brands: [{ value: 'Teste', count: 6 }], models: [], fuels: [], transmissions: [],
  year: { min: 2023, max: 2023 }, mileage: { min: 20000, max: 20000 }, price: { min: '21000.00', max: '21000.00' },
} };
let wire = [];
const api = createServer((req, res) => {
  const url = new URL(req.url, 'http://fixture'), p = url.pathname.replace('/api/public/vehicles', '');
  const match = /\/photos\/(\d+)$/.exec(p);
  if (match) {
    const n = Number(match[1]), w = Number(url.searchParams.get('w') || 1600), body = variants[n]?.get(w);
    if (!body || (url.searchParams.has('v') && url.searchParams.get('v') !== versions[n])) { res.writeHead(404); res.end(); return; }
    const etag = `"${versions[n]}-${w}"`, cached = req.headers['if-none-match'] === etag;
    wire.push({ path: p, width: w, status: cached ? 304 : 200, bytes: cached ? 0 : body.length });
    res.writeHead(cached ? 304 : 200, { 'content-type': 'image/webp', 'x-photo-version': versions[n], etag,
      'cache-control': 'private, no-cache, max-age=0, must-revalidate', ...(!cached ? { 'content-length': body.length } : {}) });
    // Make the transition observable while a first 1600 request is outstanding.
    if (cached) res.end(); else setTimeout(() => res.end(body), w === 1600 ? 120 : 0);
    return;
  }
  const data = p.endsWith('/photos/access') ? { versions,photoDimensions:items[0].photoDimensions }
    : p.endsWith('/related') ? items.filter(v => !p.includes(v.slug)).slice(0, 5)
    : p === '/homepage-highlights' ? { configured: true, items: items.slice(0, 5).map(vehicle => ({ vehicle, photoIndex: 0 })) }
    : p === '/brands' ? catalog.facets.brands : items.find(v => p === '/' + v.slug) ?? catalog;
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const apiPort = await listen(api), results = [];
let browser, child;
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  for (const mode of process.env.PHOTO_MEASUREMENT_MODES?.split(',') || ['before', 'responsive']) {
    const historical=mode==='before'?Object.fromEntries(['vehiclePhotoSources.ts','publicThumbnail.ts','publicGallerySession.ts','publicGalleryPhoto.ts','components/VehiclePhotoRail.svelte','components/stand-concepts/DesignEdition.svelte'].map(file=>[file,execFileSync('git',['show',`3f41972:apps/website/src/lib/${file}`],{encoding:'utf8'})])):{};
    const probe = createServer(), port = await listen(probe); await new Promise(resolve => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const config = path.join(site, '.svelte-kit', `measure-${mode}.config.mjs`);
    await mkdir(path.dirname(config), { recursive: true });
    await writeFile(config, `import base from ${JSON.stringify(path.join(site, 'vite.config.ts'))};
export default {...base, plugins:[{name:'measurement-baseline',enforce:'pre',transform(code,id){
const old=Object.entries(${JSON.stringify(historical)}).find(([file])=>id.endsWith('/'+file));if(old)return old[1];
if(${JSON.stringify(mode)}==='fixed1600' && id.endsWith('/DesignEdition.svelte')) return code.replaceAll('cardPhoto(vehicle.image)', 'sizedPhoto(vehicle.image, 1600)').replaceAll('cardPhotoSet(vehicle.image)', 'undefined');
if(${JSON.stringify(mode)}==='fixed1600' && (id.endsWith('/FeaturedPhoto.svelte') || id.endsWith('/HomeHeroDirections.svelte'))) return code.replace('{ cardPhoto, cardPhotoSet }','{ sizedPhoto, vehiclePhotoSet }').replaceAll('cardPhoto(frame.source)', 'sizedPhoto(frame.source, 1600)').replaceAll('cardPhoto(firstImage)', 'sizedPhoto(firstImage, 1600)').replaceAll('cardPhotoSet(', 'vehiclePhotoSet(');
}},...base.plugins], server:{...base.server,fs:{allow:${JSON.stringify([root, await realpath(path.join(root, 'node_modules'))])}}}};`);
    child = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--config', config],
      { cwd: site, env: { ...process.env, PUBLIC_BACKEND_URL: `http://127.0.0.1:${apiPort}` }, stdio: 'pipe' });
    let logs = ''; child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
    for (let i = 0; ; i++) {
      try { if ((await fetch(origin)).ok) break; } catch {}
      if (i > 150 || child.exitCode !== null) throw Error(logs);
      await new Promise(r => setTimeout(r, 100));
    }
    for (const [profile, width, height, dpr] of [['desktop', 1440, 900, 1], ['mobile', 390, 844, 2]]) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Do not install Playwright routing: it disables the browser HTTP cache.
      // Count only photo responses from the local fixture backend.
      const snapshot = async stage => {
        await page.waitForLoadState('networkidle'); await page.waitForTimeout(200);
        const requests = wire.splice(0);
        const cards = await page.locator('.vehicle-card.public-card .card-image img').evaluateAll(images => images.map(i => ({ src: i.currentSrc, width: i.getBoundingClientRect().width, height: i.getBoundingClientRect().height, sizes: i.sizes })));
        console.log(mode, profile, stage, requests.length, requests.reduce((s, r) => s + r.bytes, 0));
        results.push({ mode, profile, stage, bytes: requests.reduce((s, r) => s + r.bytes, 0), requests: requests.length,
          downloads: requests.filter(r => r.status === 200).length, revalidations: requests.filter(r => r.status === 304).length,
          widths: [...new Set(requests.map(r => r.width))], transfers: requests, cards });
      };
      wire = [];
      await page.goto(origin + '/viaturas', { waitUntil: 'networkidle' });
      const cards = page.locator('.vehicle-card.public-card');
      assert.equal(await cards.count(), 6, 'catalogue fixture');
      // Same six cards in each profile, including cards initially below the fold.
      for (const card of await cards.all()) await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>[...document.querySelectorAll('.vehicle-card.public-card .card-image img')].some(image=>/^\d+(?:\.\d+)?px$/.test(image.sizes)));
      await snapshot('catalog-cold');
      await page.screenshot({ path: path.join(screenshots, `${mode}-${profile}-catalog.png`) });
      await page.evaluate(() => {
        window.__cardPreview = { seen: false, busy: false };
        new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (node instanceof Element && node.matches('[data-card-photo-preview]')) {
              window.__cardPreview.seen = true;
              requestAnimationFrame(() => {
                if (node.isConnected) window.__cardPreview.busy ||= node.parentElement.getAttribute('aria-busy') === 'true';
              });
            }
          }
        }).observe(document.body, { childList: true, subtree: true });
      });
      await cards.first().locator('.card-detail-link').click();
      await page.locator('.detail-thumbnails img').first().waitFor();
      await snapshot('enter-detail-three-photos');
      const preview = await page.evaluate(() => window.__cardPreview??{seen:false,busy:false,documentChanged:true});
      if(process.env.PHOTO_RELAX_PREVIEW!=='true'){assert.equal(preview.seen, true, `${mode}/${profile}: decoded card preview`);assert.equal(preview.busy, false, 'preview does not show loading');}
      results.at(-1).preview = preview;
      assert.equal(await page.locator('[data-card-photo-preview]').count(), 0, 'preview removed after 1600 decodes');
      for (const button of await page.locator('.detail-thumbnails button[aria-label^="Ver fotografia"]').all()) await button.click();
      await page.getByRole('button', { name: 'Abrir em ecrã inteiro', exact: true }).click();
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
      await snapshot('gallery-and-fullscreen');
      await page.screenshot({ path: path.join(screenshots, `${mode}-${profile}-fullscreen.png`) });
      await page.keyboard.press('Escape');
      await page.goto(origin + '/viaturas', { waitUntil: 'networkidle' });
      for (const card of await page.locator('.vehicle-card.public-card').all()) await card.scrollIntoViewIfNeeded();
      await snapshot('catalog-http-cache');
      await page.locator('.vehicle-card.public-card .card-detail-link').first().click();
      await snapshot('detail-revisit');
      assert.deepEqual(errors, []);
      await context.close();
      // Independent cold pages verify the other uses of the shared card.
      for (const [route, selector, stage] of [['/', '.vehicle-card.public-card', 'home-visible'],
        [`/viaturas/${items[0].slug}`, '.related .vehicle-card.public-card', 'related-visible']]) {
        const check = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, reducedMotion: 'reduce' });
        const view = await check.newPage();
        await view.goto(origin + route, { waitUntil: 'networkidle' });
        if (route === '/') {
          const featured = view.locator('.hd-photo img:not([aria-hidden="true"])');
          assert.equal(await featured.count(), 1, 'featured public card');
          const featuredSource = await featured.evaluate(i => ({ src: i.currentSrc, srcset: i.srcset, sizes: i.sizes }));
          if (mode === 'responsive') assert(featuredSource.srcset.includes('320w'), 'featured card responsive');
          results.push({ mode, profile, stage: 'featured-card', ...featuredSource });
        }
        const selected = view.locator(selector);
        assert(await selected.count(), stage + ': shared cards exist');
        wire = [];
        await selected.first().scrollIntoViewIfNeeded();
        await view.waitForLoadState('networkidle');
        await view.waitForTimeout(200);
        const chosen = await selected.locator('.card-image img').evaluateAll(images => images.map(i => ({
          src: i.currentSrc, srcset: i.srcset, width: i.getBoundingClientRect().width, height: i.getBoundingClientRect().height, sizes: i.sizes,
        })));
        assert(chosen.some(i => i.src.includes('/photos/0')), stage + ': loaded photographic card');
        if (mode === 'responsive') assert(chosen.every(i => i.srcset.includes('320w') && i.srcset.includes('2560w')), stage + ': responsive candidates');
        results.push({ mode, profile, stage, cards: chosen, transfersAfterScroll: wire.splice(0) });
        await view.screenshot({ path: path.join(screenshots, `${mode}-${profile}-${stage}.png`) });
        await check.close();
      }
    }
    child.kill(); child = undefined;
  }
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ sources: paths, metadata: metadata.map(m => ({ width: m.width, height: m.height })), variants: variants.map(v => Object.fromEntries([...v].map(([w, b]) => [w, b.length]))), results }, null, 2));
  console.table(results.filter(r => r.widths).map(({ mode, profile, stage, bytes, requests, revalidations, widths }) => ({ mode, profile, stage, bytes, requests, revalidations, widths: widths.join('/') })));
} finally { child?.kill(); await browser?.close(); api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
