// After the website Node build. Uses only fixture data; no Supabase or production API.
// Run: PLAYWRIGHT_CHANNEL=chrome node scripts/check-vehicle-images.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const base = {
  brand: 'Teste',
  year: 2020,
  fuel: 'DIESEL',
  mileage: 20000,
  price: '21000.00',
  currency: 'EUR',
  description: null,
  transmission: null,
  availability: 'AVAILABLE',
};
const none = { ...base, model: 'Sem fotografia', slug: 'sem-foto-abcdef123456', photos: [] };
const broken = {
  ...base,
  model: 'Falha fotografia',
  slug: 'falha-foto-abcdef123456',
  photos: [0, 1].map((i) => `/api/public/vehicles/falha-foto-abcdef123456/photos/${i}`),
};
const items = [none, broken];
const catalog = {
  items,
  total: 2,
  page: 1,
  pageSize: 30,
  totalPages: 1,
  facets: {
    brands: [{ value: 'Teste', count: 2 }],
    models: [],
    fuels: [],
    transmissions: [],
    year: { min: 2020, max: 2020 },
    mileage: { min: 20000, max: 20000 },
    price: { min: '21000.00', max: '21000.00' },
  },
};
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const listen = async (server) => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
};
const api = createServer((req, res) => {
  const path = new URL(req.url, 'http://fixture').pathname.replace('/api/public/vehicles', '');
  if (path.includes('/photos/')) {
    res.writeHead(path.endsWith('/1') ? 200 : 503, { 'content-type': 'image/png' });
    res.end(path.endsWith('/1') ? png : undefined);
    return;
  }
  const data =
    path === '/brands'
      ? catalog.facets.brands
      : path === '/homepage-highlights'
        ? { configured: true, items: [{ vehicle: broken, photoIndex: 0 }] }
        : path.endsWith('/related')
          ? items
          : (items.find((v) => path === `/${v.slug}`) ?? catalog);
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
});
let child, browser;
try {
  const backendPort = await listen(api);
  const probe = createServer();
  const port = await listen(probe);
  await new Promise((resolve) => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['build/index.js'], {
    cwd: 'apps/website',
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      ORIGIN: origin,
      INTERNAL_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
      SITE_NOINDEX: 'true',
    },
    stdio: 'pipe',
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin);
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert(ready, 'fixture website starts');
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  const page = await browser.newPage();
  const errors = [];
  const badUrls = [];
  await page.route('https://images.unsplash.com/**', (route) => route.abort());
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('images.unsplash.com/http')) badUrls.push(request.url());
  });
  await page.addInitScript(
    ({ ids }) => {
      localStorage.setItem('anm-favorites-v1', JSON.stringify(ids));
      localStorage.setItem('anm-comparison-v1', JSON.stringify(ids));
    },
    { ids: items.map((v) => v.slug) },
  );
  const check = async (locator, placeholder) => {
    await locator.scrollIntoViewIfNeeded();
    await locator.evaluate((img) => (img.loading = 'eager'));
    try {
      await page.waitForFunction(
        ({ element, placeholder }) =>
          element.complete &&
          element.naturalWidth > 0 &&
          element.src.includes('catalog-placeholder') === placeholder,
        { element: await locator.elementHandle(), placeholder },
        { timeout: 10000 },
      );
    } catch (error) {
      console.error(
        'Image state:',
        await locator.evaluate((img) => ({
          src: img.src,
          currentSrc: img.currentSrc,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
        })),
        'Malformed requests:',
        badUrls,
      );
      throw error;
    }
  };
  for (const path of ['/viaturas', '/favoritos']) {
    await page.goto(origin + path);
    await check(page.locator(`.card-image[href="/viaturas/${none.slug}"] img`).first(), true);
    await check(page.locator(`.card-image[href="/viaturas/${broken.slug}"] img`).first(), true);
    console.log(`PASS hydrated cards ${path}: no photo and failed photo`);
  }
  await page.goto(origin);
  await page.locator('a[href="/viaturas"]').first().click();
  await page.waitForURL(origin + '/viaturas');
  await check(page.locator(`.card-image[href="/viaturas/${none.slug}"] img`).first(), true);
  assert.deepEqual(badUrls, [], 'client navigation preserves the imported placeholder URL');
  console.log('PASS client navigation: versioned placeholder stays local');
  await page.goto(origin + '/comparar');
  await check(page.locator(`a[href="/viaturas/${none.slug}"] img`).first(), true);
  await check(page.locator(`a[href="/viaturas/${broken.slug}"] img`).first(), true);
  console.log('PASS comparison: no photo and failed photo');
  await page.goto(origin + `/viaturas/${none.slug}`);
  await check(page.locator('.vehicle-photo img'), true);
  assert(await page.locator('.vehicle-photo').isDisabled());
  await check(page.locator(`.card-image[href="/viaturas/${broken.slug}"] img`).first(), true);
  console.log('PASS no-photo detail and related carousel');
  await page.goto(origin + `/viaturas/${broken.slug}`);
  await check(page.locator('.vehicle-photo img'), true);
  await page.getByRole('button', { name: 'Ver fotografia 2', exact: true }).click();
  await check(page.locator('.vehicle-photo img'), false);
  await page.getByRole('button', { name: 'Ver fotografia 1', exact: true }).click();
  await check(page.locator('.vehicle-photo img'), true);
  await page.locator('.vehicle-photo').click();
  await check(page.locator('.gallery-dialog img'), true);
  const viewer=page.locator('.gallery-dialog');
  const previous=viewer.getByRole('button',{name:'Fotografia anterior',exact:true});
  const next=viewer.getByRole('button',{name:'Fotografia seguinte',exact:true});
  assert(await previous.isDisabled());
  await previous.click({force:true});assert.match(await viewer.innerText(),/1 \/ 2/);
  await next.click();await check(viewer.locator('img'),false);assert(await next.isDisabled());
  await page.keyboard.press('ArrowRight');assert.match(await viewer.innerText(),/2 \/ 2/);
  assert.equal(await viewer.locator('img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await viewer.evaluate(el=>el.contains(document.activeElement)));}
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow),'hidden');
  for(const [width,height] of [[1440,1000],[390,844]]){
    await page.setViewportSize({width,height});const bounds=await viewer.boundingBox();
    assert(Math.abs(bounds.x+bounds.width/2-width/2)<1);assert(Math.abs(bounds.y+bounds.height/2-height/2)<1);
    assert(bounds.x>=0&&bounds.x+bounds.width<=width+1);
    await page.screenshot({path:`.cache/crm-save/public-gallery-${width}.png`});
  }
  await page.keyboard.press('Escape');assert(await page.locator('.vehicle-photo').evaluate(el=>el===document.activeElement));
  await page.locator('.photo-next').click({force:true});assert(await page.locator('.photo-next').isDisabled());
  await page.locator('.photo-previous').click();assert(await page.locator('.photo-previous').isDisabled());
  console.log('PASS public gallery: bounded navigation, contain, centered desktop/mobile, focus trap/restore and scroll lock');
  console.log('PASS detail/gallery: failure, recovery, failure again');
  await page.goto(origin);
  await check(page.locator('.orbit-main-photo img').first(), true);
  console.log('PASS featured hero photo failure');
  assert.deepEqual(badUrls, [], 'no imported URLs routed to Unsplash');
  assert.deepEqual(errors, [], 'no browser exceptions');
  const resource = await page.locator('.orbit-main-photo img').first().getAttribute('src');
  const response = await fetch(new URL(resource, origin));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /image\/svg\+xml/);
  console.log('PASS placeholder serves SVG, no broken images or browser errors');
} finally {
  await browser?.close();
  if (child && child.exitCode === null) {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
  await new Promise((resolve) => api.close(resolve));
}
