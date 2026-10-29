// Isolated browser contexts and intercepted public reads only; never changes real inventory or user storage.
// Run against the local site: node test/savedUnavailable.browser.mjs
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.WEBSITE_URL || 'http://localhost:5173';
const output = path.resolve('.svelte-kit/saved-unavailable-review');
await mkdir(output, { recursive: true });
const realSlugs = ['audi-a3-sportback-30-tfsi-2022-527ff7026c07', 'audi-a6-avant-2023-eb5212472e45', 'audi-q3-35-tdi-quattro-2021-525fd2168c63'];
const photos = await Promise.all(realSlugs.map(async slug => {
  const access = await fetch(`${origin}/viaturas/${slug}/photos/access`);
  assert.equal(access.status, 200, 'read an existing public demonstration photo');
  const { versions } = await access.json();
  const response = await fetch(`${origin}/viaturas/${slug}/photos/0?v=${versions[0]}&w=1600`);
  assert.equal(response.status, 200);
  return { body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') };
}));
const version = 'a'.repeat(64);
const id = n => `demo-audi-${n}-${String(n + 1).padStart(12, 'a')}`;
const identity = n => ({ slug: id(n), brand: 'Audi', model: ['A3 Sportback', 'A6 Avant', 'Q3'][n % 3] + (n > 2 ? ` · ${n + 1}` : ''), year: 2022 + n % 2, photo: `/viaturas/${id(n)}/indisponivel/foto` });
const live = n => ({ slug: id(n), brand: 'Audi', model: 'A3 Sportback', year: 2022, mileage: 42000, fuel: 'GASOLINE', price: '24900.00', currency: 'EUR', description: null, transmission: 'AUTOMATIC', availability: 'AVAILABLE', photos: [`/api/public/vehicles/${id(n)}/photos/0?v=${version}`] });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
const screenshots = [];
async function scenario(route, width, mode, count) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const ids = Array.from({ length: count }, (_, n) => id(n));
  await context.addInitScript(({ ids, route }) => {
    localStorage.setItem('anm-favorites-v1', JSON.stringify(ids));
    localStorage.setItem('anm-comparison-v1', JSON.stringify(route === 'comparar' ? ids : []));
  }, { ids, route });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async request => {
    const url = new URL(request.request().url());
    if (request.request().method() !== 'GET') throw Error('Fixture forbids writes');
    if (url.pathname === '/comparar/dados') {
      const selected = url.searchParams.getAll('id');
      assert.ok(selected.length <= 3);
      return request.fulfill({ json: { items: selected.map(slug => {
        const n = ids.indexOf(slug);
        if (mode === 'mixed' && n === 0) return { id: slug, status: 200, vehicle: live(n), photoVersions: [version] };
        if (mode === 'mixed' && n === 5) return { id: slug, status: 503, vehicle: null };
        if ((mode === 'mixed' && n === 4) || (mode === 'all' && n === 11)) return { id: slug, status: 404, vehicle: null };
        const unavailableVehicle = identity(n);
        if (n === 2 && route === 'favoritos') unavailableVehicle.photo = null;
        return { id: slug, status: 404, vehicle: null, unavailableVehicle };
      }) } });
    }
    if (url.pathname.endsWith('/photos/access')) return request.fulfill({ json: { versions: [version] } });
    if (/\/photos\/0$/.test(url.pathname) || url.pathname.endsWith('/indisponivel/foto')) {
      const n = ids.findIndex(slug => url.pathname.includes(slug));
      if (mode === 'mixed' && n === 3) return request.fulfill({ status: 404, body: '' });
      const photo = photos[Math.max(0, n) % photos.length];
      return request.fulfill({ body: photo.body, contentType: photo.contentType, headers: { 'x-photo-version': version } });
    }
    return url.origin === origin ? request.continue() : request.abort();
  });
  await page.goto(`${origin}/${route}`);
  const main = page.locator(route === 'favoritos' ? '.favorites-page' : '.comparison-page');
  await page.waitForFunction(() => {
    const board = document.querySelector('.favorites-grid, .comparison-board');
    return board?.getAttribute('aria-busy') === 'false';
  });
  await page.waitForTimeout(350);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= width + 1, 'no horizontal page overflow');
  assert.deepEqual(errors, []);
  await main.evaluate(node => {
    const label = document.createElement('p');
    label.textContent = 'DEMONSTRAÇÃO · DADOS E ESTADOS FICTÍCIOS';
    label.style.cssText = 'font:600 11px/1.5 Arial;color:var(--muted);letter-spacing:.08em;border-bottom:1px solid var(--line);padding:12px 0;margin:0 0 12px';
    node.prepend(label);
  });
  const file = path.join(output, `${route}-${mode}-${width}.png`);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const bounds = await main.boundingBox();
  await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width, height: Math.ceil(bounds.y + bounds.height + 16) } }); screenshots.push(file);
  if (route === 'favoritos') {
    assert.ok((await page.locator('.toolbar').textContent()).includes(`${count} viaturas guardadas`));
    assert.equal(await page.locator('.unavailable-group h2').first().innerText().then(text => text.startsWith('Já não disponíveis')), true);
    if (mode === 'mixed') {
      assert.equal(await page.locator('.favorites-grid .vehicle-card').count(), 1);
      assert.equal(await page.locator('.saved-unavailable').count(), 4);
      assert.equal(await page.locator('.pending-favorite').count(), 1, 'lookup error stays in the normal grid');
      assert.equal(await page.locator('#pending-favorites-title').count(), 0);
      assert.equal(await page.locator('.saved-photo span[role=img]').count(), 3, 'null/broken/deleted use graceful placeholders');
      assert.equal(await page.locator('.saved-identity a').first().getAttribute('href'), `/viaturas/${id(1)}`);
      assert.equal(await page.locator('.saved-photo img').first().getAttribute('src'), identity(1).photo);
    } else {
      assert.equal(await page.locator('.saved-unavailable').count(), 12);
      assert.equal(await page.locator('.unavailable-group > p').count(), 1, 'one shared explanation instead of twelve alerts');
      await page.getByRole('button', { name: 'Seguinte', exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('.saved-unavailable').length === 8);
    }
    await page.locator('.saved-unavailable button').first().click();
    await page.waitForFunction(n => JSON.parse(localStorage.getItem('anm-favorites-v1')).length === n, count - 1);
    assert.equal(await page.locator('h1').evaluate(node => node === document.activeElement), true);
    assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('anm-favorites-v1')))).every(value => typeof value === 'string'));
  } else {
    assert.ok((await page.locator('.selection-count').textContent()).includes(`${count} de 3`));
    if (mode === 'mixed') {
      assert.ok((await page.locator('.summary-row').textContent()).includes('A6 Avant'));
      assert.equal(await page.locator('.fact-group').count() > 0, true);
      assert.equal(await page.locator('.photo-row img[src*="indisponivel/foto"]').count(), width === 390 ? 1 : 2);
    } else assert.equal(await page.locator('.fact-group').count(), 0, 'no inactive specs masquerading as comparison');
    await page.locator('.remove').first().click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('anm-comparison-v1')).length === 2);
    if (width === 390) await page.waitForFunction(() => !document.querySelector('#comparison-pair'));
    await page.getByRole('link', { name: 'Substituir', exact: false }).first().click();
    await page.waitForURL(`${origin}/viaturas`);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('anm-comparison-v1')).length), 1);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${route} ${mode} ${width}px, preserved IDs, fallbacks, removal${route === 'comparar' ? ' and replacement' : ''}`);
  await context.close();
}
try {
  for (const width of [1440, 390]) {
    await scenario('favoritos', width, 'mixed', 6);
    await scenario('favoritos', width, 'all', 20);
    await scenario('comparar', width, 'mixed', 3);
    await scenario('comparar', width, 'all', 3);
  }
  console.log('SCREENSHOTS\n' + screenshots.join('\n'));
} finally { await browser.close(); }
