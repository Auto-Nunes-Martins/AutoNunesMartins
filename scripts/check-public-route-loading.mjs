// Against an existing local production build; does not submit forms or change server data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.PUBLIC_SITE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  const errors = [];
  page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
  page.on('pageerror', error => errors.push(error.message));
  const response = await page.goto(origin + '/', { waitUntil: 'networkidle' });
  const html = await response.text();
  const ids = html.match(/node_ids:\s*\[([\d,\s]+)\]/)?.[1].split(',').map(Number);
  assert(ids?.length, 'SSR bootstrap must declare the initial route nodes');
  const initialNodes = requests.filter(r => /\/_app\/immutable\/nodes\/\d+\./.test(r.url));
  assert(initialNodes.length > 0);
  for (const request of initialNodes) {
    const id = Number(request.url.match(/\/nodes\/(\d+)\./)[1]);
    assert(ids.includes(id) || id === 1, 'An unrelated route was downloaded before navigation intent: ' + request.url);
  }
  assert.equal(await page.locator('body').getAttribute('data-sveltekit-preload-code'), 'hover');
  assert.equal(await page.locator('body').getAttribute('data-sveltekit-preload-data'), 'off');
  const featuredHref = await page.locator('a.hd-photo').first().getAttribute('href');
  const requestCount = requests.length;
  const catalog = page.locator('nav a[href="/viaturas"]').first();
  const preloaded = page.waitForRequest(r => r.resourceType() === 'script' && /\/_app\/immutable\/nodes\//.test(r.url()));
  await catalog.hover();
  await preloaded;
  await page.waitForLoadState('networkidle');
  assert(!requests.slice(requestCount).some(r => r.url.includes('/__data.json')), 'Hover must not fetch live route data');
  await catalog.click();
  await page.waitForURL(origin + '/viaturas');
  await page.locator('main h1').waitFor();
  assert((await page.locator('.vehicle-card').count()) > 0, 'Catalog cards must render after client navigation');
  await page.goBack();
  await page.waitForURL(origin + '/');
  await page.locator('.hd-root').waitFor();
  await page.goto(origin + featuredHref, { waitUntil: 'networkidle' });
  const photoRequests = [];
  page.on('request', r => { if (r.url().includes(featuredHref + '/photos/')) photoRequests.push(r.url()); });
  const choose = async number => {
    await page.getByRole('button', { name: 'Ver fotografia ' + number, exact: true }).first().click();
    await page.waitForFunction(n => {
      const photo = document.querySelector('.vehicle-photo');
      return photo?.getAttribute('aria-busy') === 'false' && photo.querySelector('img')?.alt.includes('fotografia ' + n);
    }, number);
  };
  const available = await page.locator('.detail-thumbnails button[aria-label^="Ver fotografia"]').count();
  assert(available >= 3, 'Regression fixture needs a published vehicle with at least three photos');
  await choose(2);
  await choose(3);
  const beforeReturn = photoRequests.length;
  await choose(2);
  await page.waitForTimeout(150);
  assert.equal(photoRequests.length, beforeReturn, 'Revisiting decoded photos must not revalidate or download');
  await page.locator('.vehicle-photo').click();
  await page.locator('dialog.gallery-dialog[open]').waitFor();
  assert(await page.locator('.viewer-thumbnails img').evaluateAll(images => images.every(n => n.complete && n.currentSrc && !n.draggable)), 'Viewer thumbnails must appear together from retained pixels');
  await page.keyboard.press('Escape');
  await page.locator('dialog.gallery-dialog[open]').waitFor({ state: 'detached' });
  const share = page.getByRole('button', { name: 'Partilhar viatura', exact: true }).first();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  });
  const beforeShare = await share.boundingBox();
  await share.click();
  await share.getByText('Copiado', { exact: true }).waitFor();
  const afterShare = await share.boundingBox();
  assert.equal(afterShare.width, beforeShare.width, 'Inline share feedback must keep button width');
  assert.equal(afterShare.height, beforeShare.height);
  await share.focus();
  assert(await share.evaluate(n => n === document.activeElement));
  assert.deepEqual(errors, []);
  console.log('Route code loads on intent, SSR/client navigation works, hover does not fetch data, gallery revisits use retained pixels, viewer thumbnails are grouped and share feedback stays inline.');
} finally {
  await browser.close();
}
