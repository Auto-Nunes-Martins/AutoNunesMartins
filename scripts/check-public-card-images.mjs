// Run against a local build with a public fixture containing persisted cover dimensions.
// No forms, vehicle edits or storage writes are performed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.PUBLIC_SITE_TEST_ORIGIN || 'http://127.0.0.1:3192';
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
try {
  const cases = [
    ['/', 1024], ['/', 1199], ['/', 1200], ['/', 1597], ['/', 1920], ['/', 2560],
    ['/viaturas', 800], ['/viaturas', 1100], ['/viaturas', 1440],
    ['/favoritos', 1000], ['/favoritos', 1440],
  ];
  for (const [route, width] of cases) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.5 });
    const page = await context.newPage();
    const errors = [];
    const photos = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (/\/photos\/0$/.test(url.pathname)) photos.push(url);
    });
    if (route === '/favoritos') {
      await page.goto(origin + '/', { waitUntil: 'networkidle' });
      const buttons = page.getByRole('button', { name: /^Guardar .+ nos favoritos$/ });
      assert(await buttons.count(), 'Fixture must supply favorite controls');
      for (let index = 0; index < Math.min(3, await buttons.count()); index++) await buttons.nth(0).click();
      photos.length = 0;
    }
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    const cards = page.locator('.vehicle-card.public-card');
    assert(await cards.count(), `${route}: fixture must supply public cards`);
    await cards.first().scrollIntoViewIfNeeded();
    await cards.last().scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(100);
    const sources = await cards.locator('.card-image img').evaluateAll(images => images.map(image => image.currentSrc).filter(Boolean));
    const grouped = new Map();
    for (const url of photos) {
      const key = url.pathname + '?v=' + url.searchParams.get('v');
      if (!sources.some(source => new URL(source).pathname === url.pathname)) continue;
      if (!grouped.has(key)) grouped.set(key, new Set());
      grouped.get(key).add(url.searchParams.get('w'));
    }
    assert(grouped.size, `${route}: fixture must load real cover photographs`);
    for (const [photo, widths] of grouped) assert.equal(widths.size, 1, `${width}px ${route}: repeated resolution request for ${photo}: ${[...widths]}`);
    assert.deepEqual(errors, []);
    console.log(`${width}px ${route}: ${grouped.size} covers, one requested resolution per cover`);
    await context.close();
  }
} finally {
  await browser.close();
}
