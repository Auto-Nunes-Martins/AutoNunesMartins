// Real public route/components against an isolated read-only fixture API.
// node scripts/check-public-card-interactions.mjs
import assert from 'node:assert/strict';
import { createServer as httpServer } from 'node:http';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = resolve('.');
async function cardSpacingMetrics(card) {
  return card.evaluate(el => {
    const box = selector => el.querySelector(selector).getBoundingClientRect();
    const card = el.getBoundingClientRect(), info = box('.card-info > a'), price = box('.card-price'), specs = box('.card-specs');
    const heading = box('h3'), heart = box('.card-favorite svg');
    return { height: card.height, image: box('.card-image').height,
      abovePrice: price.top - info.bottom, belowPrice: specs.top - price.bottom,
      favoriteCenterError: Math.abs(heart.top + heart.height / 2 - heading.top - parseFloat(getComputedStyle(el.querySelector('h3')).lineHeight) / 2),
      detailsBottomSpace: card.bottom - specs.bottom,
      title: { size: getComputedStyle(el.querySelector('h3')).fontSize, weight: getComputedStyle(el.querySelector('h3')).fontWeight },
      version: el.querySelector('.card-version') ? { size: getComputedStyle(el.querySelector('.card-version')).fontSize, weight: getComputedStyle(el.querySelector('.card-version')).fontWeight } : null };
  });
}
if (process.argv.includes('--live')) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const touch = process.argv.includes('--touch');
    const page = await browser.newPage({ viewport: { width: touch ? 390 : 1440, height: 1080 }, reducedMotion: 'reduce', isMobile: touch, hasTouch: touch });
    const q5 = process.argv.includes('--q5');
    await page.goto('http://localhost:5173/viaturas' + (q5 ? '?marca=Audi&q=Q5' : ''));
    const card = page.locator('.vehicle-card').first();
    const button = card.locator('.card-compare button');
    await button.waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.card-compare button')?.disabled);
    assert.equal(await button.evaluate(el => el.getBoundingClientRect().height), touch ? 44 : 36);
    assert.equal(await button.evaluate(el => getComputedStyle(el).borderWidth), '0px');
    await page.mouse.move(0, 0);
    const metrics = await cardSpacingMetrics(card);
    assert(Math.abs(metrics.abovePrice - metrics.belowPrice) <= 1, 'price gaps must be symmetric');
    assert(metrics.favoriteCenterError <= 1, 'heart aligns with the first title line');
    const normal = await button.evaluate(el => getComputedStyle(el).backgroundColor);
    await button.hover();
    const hover = await button.evaluate(el => getComputedStyle(el).backgroundColor);
    if (!touch) assert.notEqual(normal, hover);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    const selectedHover = await button.evaluate(el => getComputedStyle(el).backgroundColor);
    assert.equal(selectedHover, touch ? 'rgb(227, 6, 19)' : 'rgb(184, 5, 16)');
    await page.mouse.move(0, 0);
    assert.deepEqual(await button.evaluate(el => ({ border: getComputedStyle(el).borderWidth, background: getComputedStyle(el).backgroundColor })), { border: '0px', background: 'rgb(227, 6, 19)' });
    await page.mouse.move(0, 0);
    await mkdir(resolve(root, '.cache/public-card-interactions'), { recursive: true });
    if (q5) {
      assert.equal(await card.locator('h3').innerText(), 'Audi Q5');
      assert.equal(await card.locator('.card-version').innerText(), '50 TFSI e quattro');
    }
    await card.screenshot({ path: resolve(root, `.cache/public-card-interactions/${q5 ? 'live-q5-card' : 'live-card'}${touch ? '-mobile' : ''}.png`) });
    assert.equal(await card.locator('.card-specs svg').nth(1).getAttribute('width'), '22');
    assert(await card.locator('.card-specs svg').nth(1).locator('path').getAttribute('d') === 'M4 19 8 5m8 0 4 14M12 6v2m0 3v2m0 3v2');
    assert.equal(await card.locator('.card-specs').evaluate(el => getComputedStyle(el).justifyContent), 'space-between');
    console.log(JSON.stringify({ liveMain: true, normal, hover, selectedNormal: 'rgb(227, 6, 19)', selectedHover, border: '0px', propertyIconSize: 22, metrics }));
  } finally { await browser.close(); }
  process.exit(0);
}
const items = Array.from({ length: 6 }, (_, i) => ({
  slug: `audi-a3-${i}-012345abcdef`, brand: 'Audi', model: i === 2 ? 'A3 Limousine com um nome comprido para verificar as quebras' : i === 4 ? 'Q5' : 'A3 Limousine',
  year: 2019, fuel: i === 4 ? 'PLUGIN_HYBRID' : 'DIESEL', mileage: i === 4 ? 1234567 : 209500, price: '19900.00', currency: 'EUR',
  description: 'Descrição da viatura de teste.', transmission: 'AUTOMATIC',
  specifications: i === 1 ? {} : { version: i === 3 ? '2.0 TDI S tronic quattro — versão de demonstração com uma descrição longa para testar as quebras' : i === 4 ? '50 TFSI e quattro' : '1.6 TDI S-line' }, availability: 'AVAILABLE', photos: [],
}));
const catalog = { items, total: items.length, page: 1, pageSize: 9, totalPages: 1,
  facets: { brands: [{ value: 'Audi', count: 6 }], models: [], fuels: [], transmissions: [], year: { min: 2019, max: 2019 }, mileage: { min: 209500, max: 209500 }, price: { min: '19900.00', max: '19900.00' } } };
const api = httpServer((req, res) => {
  const path = new URL(req.url, 'http://fixture').pathname;
  let body;
  if (path === '/api/public/vehicles') body = catalog;
  else if (path.endsWith('/brands')) body = catalog.facets.brands;
  else if (path.endsWith('/related')) body = items.slice(1);
  else body = items.find(v => path.endsWith('/' + v.slug));
  res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body ?? {}));
});
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve));
const backend = `http://127.0.0.1:${api.address().port}`;
process.env.INTERNAL_BACKEND_URL = backend;
process.env.PUBLIC_BACKEND_URL = backend;
process.chdir(resolve(root, 'apps/website'));
const server = await createServer({ server: { port: 5195, strictPort: true, host: '127.0.0.1' } });
let browser;
const output = resolve(root, '.cache/public-card-interactions');
await mkdir(output, { recursive: true });
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1080 }, reducedMotion: 'reduce', isMobile: width <= 700, hasTouch: width <= 700 });
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    for (const theme of ['light', 'dark']) {
      try { await page.goto('http://127.0.0.1:5195/viaturas', { timeout: 120000 }); }
      catch (error) {
        if (!String(error).includes('ERR_ABORTED')) throw error;
        await page.goto('http://127.0.0.1:5195/viaturas', { timeout: 120000 });
      }
      console.log(`Loaded fixture catalog: ${width}px ${theme}`);
      const card = page.locator('.vehicle-card').first();
      await card.waitFor();
      await page.waitForFunction(() => !document.querySelector('.card-compare button')?.disabled);
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await card.scrollIntoViewIfNeeded();
      assert.equal(await card.locator('h3').innerText(), 'Audi A3 Limousine');
      assert.equal(await card.locator('.card-version').innerText(), '1.6 TDI S-line');
      assert.equal(await page.locator('.vehicle-card').nth(1).locator('.card-version').count(), 0);
      assert.equal(await page.locator('a a').count(), 0);
      assert(await card.evaluate(el => [...el.querySelectorAll('h3,.card-specs,.card-price,.card-compare')].every(n => n.scrollWidth <= n.clientWidth + 1)));
      assert(await page.locator('.vehicle-card').evaluateAll(cards => cards.every(el => [...el.querySelectorAll('h3,.card-version,.card-specs,.card-price')].every(n => n.scrollWidth <= n.clientWidth + 1))));
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1));
      const favorite = card.locator('.card-favorite button');
      const before = await favorite.getAttribute('aria-pressed');
      await favorite.click();
      assert.notEqual(await favorite.getAttribute('aria-pressed'), before);
      assert(new URL(page.url()).pathname === '/viaturas');
      const compare = card.locator('.card-compare button');
      assert.equal(await compare.evaluate(el => el.getBoundingClientRect().height), width <= 700 ? 44 : 36);
      assert.equal(await compare.evaluate(el => getComputedStyle(el).borderWidth), '0px');
      const previous = await compare.getAttribute('aria-pressed');
      await compare.click();
      assert.notEqual(await compare.getAttribute('aria-pressed'), previous);
      assert.equal(await compare.evaluate(el => getComputedStyle(el).borderWidth), '0px');
      const metrics = await cardSpacingMetrics(card);
      assert(Math.abs(metrics.abovePrice - metrics.belowPrice) <= 1, 'price gaps must be symmetric');
      assert(metrics.favoriteCenterError <= 1, 'heart aligns with the first title line');
      assert(Math.abs(metrics.abovePrice - 18) <= 1, 'price uses a clear 18px gap');
      assert(metrics.detailsBottomSpace >= 18, 'details need breathing room above the card base');
      assert(await card.locator('.card-price').evaluate(el => el.nextElementSibling?.classList.contains('card-specs')));
      assert.equal(await card.locator('.card-price a').count(), 0);
      assert.equal(await card.locator('.card-arrow').count(), 1);
      for (const other of await page.locator('.vehicle-card').all()) {
        const layout = await cardSpacingMetrics(other);
        assert(Math.abs(layout.abovePrice - layout.belowPrice) <= 1, 'symmetric gaps also for no/long versions');
        assert(layout.favoriteCenterError <= 1, 'heart aligns with the first line of long titles');
      }
      console.log(JSON.stringify({ width, theme, metrics }));
      assert(new URL(page.url()).pathname === '/viaturas');
      const href = await card.locator('.card-detail-link').getAttribute('href');
      // Body padding and specs are covered by a native anchor, including context/middle click.
      const hit = await card.locator('.card-body').evaluate(body => {
        const box = body.getBoundingClientRect();
        return document.elementFromPoint(box.left + 2, box.top + 2)?.closest('a')?.getAttribute('href');
      });
      assert.equal(hit, href);
      await page.screenshot({ path: resolve(output, `${width}-${theme}.png`) });
      const popupWait = page.context().waitForEvent('page');
      await card.locator('.card-body').click({ position: { x: 2, y: 2 }, button: 'middle' });
      const popup = await popupWait;
      await popup.waitForLoadState();
      assert.equal(new URL(popup.url()).pathname, href);
      await popup.close();
      await page.keyboard.press('Tab');
      await card.locator('.card-detail-link').focus();
      assert.equal(await card.locator('.card-detail-link').evaluate(el => el.matches(':focus-visible')), true);
      await page.keyboard.press('Enter');
      await page.waitForURL('**' + href);
      // The public detail alone exposes sharing. Force clipboard fallback deterministically.
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedVehicle = text; } } });
      });
      await page.getByRole('button', { name: 'Partilhar viatura', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Ligação copiada.' }).waitFor();
      assert.equal(await page.evaluate(() => window.__copiedVehicle), `http://127.0.0.1:5195${href}`);
      await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
      await page.getByRole('button', { name: 'Partilhar viatura', exact: true }).click();
      const manual = page.getByLabel('Ligação da viatura', { exact: true });
      await manual.waitFor();
      assert.equal(await manual.inputValue(), `http://127.0.0.1:5195${href}`);
      assert(await manual.evaluate(el => document.activeElement === el));
      await page.screenshot({ path: resolve(output, `${width}-${theme}-share.png`) });
      await page.goBack();
      const specs = page.locator('.vehicle-card').first().locator('.card-specs');
      await specs.evaluate(el => el.scrollIntoView({ block: 'center' }));
      const specsBox = await specs.boundingBox();
      await page.mouse.click(specsBox.x + specsBox.width / 2, specsBox.y + specsBox.height / 2);
      await page.waitForURL('**' + href);
      const carousel = page.locator('.carousel');
      await carousel.scrollIntoViewIfNeeded();
      const detailUrl = page.url();
      const related = carousel.locator('[data-vehicle] .card-body').filter({ visible: true }).first();
      const box = await related.boundingBox();
      await page.mouse.move(box.x + box.width * .7, box.y + 4);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .7 - 90, box.y + 4, { steps: 6 });
      await page.mouse.up();
      assert.equal(page.url(), detailUrl, 'carousel drag must not open a card');
      await page.locator('.integrated-controls button').last().click();
      assert.equal(page.url(), detailUrl, 'carousel arrows must not open a card');
      console.log(`Passed public card interactions: ${width}px ${theme}`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
  await new Promise(resolve => api.close(resolve));
}
