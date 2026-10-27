// Local fixtures only; does not contact or change the live backend.
// Run from apps/website: node test/mobileGallery.browser.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const photos = await Promise.all(
  ['#647b88', '#a58a72', '#6c8475'].map((color, n) =>
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${n === 1 ? 1600 : 900}"><rect width="1200" height="${n === 1 ? 1600 : 900}" fill="${color}"/><text x="400" y="450" font-size="80">Foto ${n + 1}</text></svg>`,
      ),
    )
      .png()
      .toBuffer(),
  ),
);

const vehicles = Array.from({ length: 5 }, (_, i) => {
  const slug = `gallery-check-${String(i).padStart(12, 'a')}`;
  return {
    slug,
    brand: 'Marca',
    model: `Modelo ${i + 1}`,
    year: 2023,
    fuel: 'GASOLINE',
    mileage: 20000,
    price: '20000.00',
    currency: 'EUR',
    description: 'Viatura de teste local.',
    transmission: 'MANUAL',
    availability: 'AVAILABLE',
    photos: [0, 1, 2].map((n) => `/api/public/vehicles/${slug}/photos/${n}`),
  };
});
const backend = createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(req.url.endsWith('/related') ? vehicles : vehicles[0]));
});
await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${backend.address().port}`;
const port = 5197;
const origin = `http://127.0.0.1:${port}`;
const vite = spawn(
  process.execPath,
  [
    '../../node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  {
    env: { ...process.env, PUBLIC_BACKEND_URL: api },
    stdio: 'pipe',
  },
);
let logs = '';
vite.stdout.on('data', (data) => {
  logs += data;
});
vite.stderr.on('data', (data) => {
  logs += data;
});
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    if (attempt > 100 || vite.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/photos/')) {
      const n = Number(url.pathname.split('/').at(-1));
      return route.fulfill({ contentType: 'image/png', body: photos[n] ?? photos[0] });
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.goto(`${origin}/viaturas/${vehicles[0].slug}`);
  const stage = page.locator('.vehicle-photo-stage');
  await stage.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.vehicle-photo .photo-rail-slide:not([inert]) img');
    return image?.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden';
  });
  await page.locator('.carousel .track .slide:not(.ghost)').first().waitFor();
  await stage.scrollIntoViewIfNeeded();
  const cdp = await context.newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y }],
    });
  async function swipe(dx, dy, finish = true) {
    const box = await stage.boundingBox();
    const x = box.x + box.width * 0.6,
      y = box.y + box.height * 0.45;
    await touch('touchStart', x, y);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', x + (dx * i) / 6, y + (dy * i) / 6);
      await page.waitForTimeout(20);
    }
    if (finish) await touch('touchEnd', x + dx, y + dy);
    return { x: x + dx, y: y + dy };
  }
  const counter = page.locator('.vehicle-photo .photo-counter');
  const initial = await counter.textContent();
  const end = await swipe(-100, 20, false);
  assert.equal(await stage.locator('.photo-rail-track').getAttribute('data-moving'), 'true');
  await touch('touchEnd', end.x, end.y);
  await page.waitForTimeout(300);
  assert.notEqual(
    await counter.textContent(),
    initial,
    'horizontal native touch must select a photo',
  );
  const selected = await counter.textContent();
  const scroll = await page.evaluate(() => scrollY);
  await swipe(8, -100);
  await page.waitForTimeout(350);
  assert.equal(await counter.textContent(), selected);
  assert.ok(
    await page.evaluate((before) => Math.abs(scrollY - before) > 20, scroll),
    'vertical touch must scroll the page',
  );
  await stage.scrollIntoViewIfNeeded();
  await stage.locator('.photo-rail-slide:not([inert]) [data-swipe-surface]').tap();
  const dialog = page.locator('.gallery-dialog');
  await dialog.waitFor({ state: 'visible' });
  await page.waitForFunction(
    () =>
      document.querySelector('.gallery-dialog .photo-rail-slide:not([inert]) img')?.naturalWidth >
      0,
  );
  const gestureOutput = '../../test-results/mobile-gallery';
  await mkdir(gestureOutput, { recursive: true });
  const activeImage = () => dialog.locator('.photo-rail-slide:not([inert]) img');
  async function openViewer() {
    if (!(await dialog.isVisible())) {
      await stage.scrollIntoViewIfNeeded();
      await stage.locator('.photo-rail-slide:not([inert]) [data-swipe-surface]').tap();
    }
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(
      () =>
        document.querySelector('.gallery-dialog .photo-rail-slide:not([inert]) img')?.naturalWidth >
        0,
    );
    await page.waitForTimeout(550);
  }
  async function imagePoints() {
    return activeImage().evaluate((image) => {
      const r = image.getBoundingClientRect(),
        scale = Math.min(r.width / image.naturalWidth, r.height / image.naturalHeight);
      const w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      const left = r.left + (r.width - w) / 2,
        top = r.top + (r.height - h) / 2;
      return {
        center: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
        black:
          top - r.top > 15
            ? { x: r.left + r.width / 2, y: top - 10 }
            : { x: left - 10, y: r.top + r.height / 2 },
      };
    });
  }
  async function viewerDrag(dx, dy, { start, cancel = false, finish = true, delay = 25 } = {}) {
    start ??= (await imagePoints()).center;
    await touch('touchStart', start.x, start.y);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', start.x + (dx * i) / 6, start.y + (dy * i) / 6);
      await page.waitForTimeout(delay);
    }
    if (finish) await touch(cancel ? 'touchCancel' : 'touchEnd', start.x + dx, start.y + dy);
    return { x: start.x + dx, y: start.y + dy };
  }
  const offset = () =>
    dialog.evaluate((node) => parseFloat(node.style.getPropertyValue('--viewer-dismiss-y')) || 0);
  await openViewer();
  await page.screenshot({ path: gestureOutput + '/fullscreen-before-drag.png' });
  let points = await imagePoints();
  await page.touchscreen.tap(points.center.x, points.center.y);
  assert.ok(await dialog.isVisible(), 'tapping the photo must keep the viewer open');
  await dialog.locator('.viewer-next').tap();
  assert.ok(await dialog.isVisible(), 'navigation controls never dismiss');
  await page.waitForTimeout(600);
  await dialog.locator('.viewer-thumbnails button').first().tap();
  await page.waitForTimeout(600);
  await dialog.locator('#gallery-caption').tap();
  assert.ok(await dialog.isVisible(), 'caption and thumbnail controls keep the viewer open');
  points = await imagePoints();
  await page.touchscreen.tap(points.black.x, points.black.y);
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
    'visible',
  );
  await openViewer();
  await viewerDrag(2, 25);
  await page.waitForTimeout(250);
  assert.ok(await dialog.isVisible(), 'short drags snap back');
  assert.equal(await offset(), 0);
  await viewerDrag(110, 120);
  assert.ok(await dialog.isVisible(), 'diagonal swipes do not dismiss');
  const indexBefore = await dialog
    .locator('.viewer-thumbnails button[aria-pressed="true"]')
    .getAttribute('aria-label');
  await viewerDrag(-130, 10);
  await page.waitForTimeout(550);
  assert.notEqual(
    await dialog
      .locator('.viewer-thumbnails button[aria-pressed="true"]')
      .getAttribute('aria-label'),
    indexBefore,
    'horizontal navigation remains responsive',
  );
  const viewerEnd = await viewerDrag(3, 130, { finish: false });
  assert.ok((await offset()) > 100, 'the photo follows the finger');
  assert.ok(
    await dialog
      .locator('.viewer-stage > .photo-rail')
      .evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m42 > 100),
    'rendered photo transform follows the finger',
  );
  assert.ok(
    Number(
      await dialog.evaluate((node) => node.style.getPropertyValue('--viewer-dismiss-opacity')),
    ) < 1,
    'backdrop fades during drag',
  );
  await page.screenshot({ path: gestureOutput + '/fullscreen-during-drag.png' });
  const backdropDuring = await dialog.evaluate(
    (node) => getComputedStyle(node, '::backdrop').backgroundColor,
  );
  console.log(JSON.stringify({ dragOffset: await offset(), backdropDuring }));
  await dialog.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'touch' });
  assert.ok((await offset()) > 100, 'WebKit pointer cancellation leaves native touch drag intact');
  await page.setViewportSize({ width: 390, height: 824 });
  assert.ok((await offset()) > 100, 'toolbar-like viewport resize preserves the drag');
  await touch('touchCancel', viewerEnd.x, viewerEnd.y);
  await page.waitForTimeout(250);
  assert.equal(await offset(), 0, 'cancelled gesture returns to its starting pose');
  await page.screenshot({ path: gestureOutput + '/fullscreen-after-cancel.png' });
  assert.ok(await dialog.isVisible());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(550);
  await viewerDrag(2, 190);
  await dialog.waitFor({ state: 'hidden' });
  await page.screenshot({ path: gestureOutput + '/fullscreen-after-dismiss.png' });
  await openViewer();
  points = await imagePoints();
  await viewerDrag(1, 190, { start: points.black });
  await dialog.waitFor({ state: 'hidden' });
  await openViewer();
  points = await imagePoints();
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: points.center.x - 30, y: points.center.y, id: 1 },
      { x: points.center.x + 30, y: points.center.y, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: points.center.x - 50, y: points.center.y + 80, id: 1 },
      { x: points.center.x + 50, y: points.center.y + 80, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(await dialog.isVisible(), 'pinching never dismisses');
  assert.equal(await offset(), 0);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1.5 });
  await viewerDrag(2, 170);
  assert.ok(await dialog.isVisible(), 'zoomed panning never dismisses');
  assert.equal(await offset(), 0);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await page.waitForTimeout(550);
  const close = dialog.locator('.dialog-close');
  assert.equal(await close.evaluate((node) => getComputedStyle(node).outlineStyle), 'none');
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle),
    'solid',
  );
  await close.tap();
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle),
    'none',
  );
  const share = page.locator('.detail-top-actions .vehicle-share');
  const actions = page.locator('.detail-top-actions');
  const shareBox = await share.boundingBox(),
    actionsBox = await actions.boundingBox();
  assert.ok(Math.abs(shareBox.x + shareBox.width - actionsBox.x - actionsBox.width) < 1);
  const carousel = page.locator('.carousel');
  await carousel.scrollIntoViewIfNeeded();
  const viewport = carousel.locator('.viewport');
  const card = carousel.locator('.slide:not(.ghost) .vehicle-card').first();
  const frame = await viewport.boundingBox(),
    cardBox = await card.boundingBox();
  assert.ok(cardBox.x - frame.x >= 3, 'card outline has a small inset');
  await carousel.locator('.track').evaluate((track) => {
    window.__cardNodes = [...track.querySelectorAll('.card-arrow, .card-compare')];
    window.__cardMutations = 0;
    new MutationObserver((records) => {
      window.__cardMutations += records.filter((r) => r.type === 'childList').length;
    }).observe(track, { childList: true, subtree: true });
  });
  await carousel.locator('.position-indicators button').nth(1).click();
  for (let frame = 0; frame < 4; frame++) {
    await page.waitForTimeout(70);
    const controls = await carousel.locator('.slide').evaluateAll((slides) => {
      const viewport = document.querySelector('.carousel .viewport').getBoundingClientRect();
      return slides
        .filter((slide) => {
          const box = slide.getBoundingClientRect();
          return (
            box.right > viewport.left &&
            box.left < viewport.right &&
            getComputedStyle(slide).visibility !== 'hidden'
          );
        })
        .flatMap((slide) =>
          [...slide.querySelectorAll('.card-arrow, .card-compare')].map((control) => ({
            opacity: getComputedStyle(slide).opacity,
            visibility: getComputedStyle(control).visibility,
          })),
        );
    });
    assert.ok(controls.length >= 2);
    assert.ok(
      controls.every((control) => control.opacity === '1' && control.visibility === 'visible'),
    );
  }
  await page.waitForTimeout(600);
  for (const index of [4, 0, 3, 1, 0]) {
    await carousel.locator('.position-indicators button').nth(index).click();
    await page.waitForTimeout(750);
    assert.ok(
      await carousel
        .locator('.track')
        .evaluate(
          (track) =>
            window.__cardNodes.every((node) => track.contains(node)) &&
            window.__cardMutations === 0,
        ),
      'settling and loop normalization must not move/remount card DOM',
    );
  }
  const output = '../../test-results/mobile-gallery';
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: `${output}/related-portrait.png` });
  await page.setViewportSize({ width: 844, height: 390 });
  await stage.scrollIntoViewIfNeeded();
  const landscape = await stage.boundingBox();
  assert.ok(landscape.width > 740 && landscape.height > 340, 'landscape uses a full-width gallery');
  assert.equal(
    await stage
      .locator('.photo-rail img')
      .first()
      .evaluate((node) => getComputedStyle(node).objectFit),
    'contain',
  );
  await page.screenshot({ path: `${output}/main-landscape.png` });
  await stage.locator('.photo-rail-slide:not([inert]) [data-swipe-surface]').tap();
  const photo = await dialog.locator('.viewer-stage').boundingBox();
  const thumbs = await dialog.locator('.viewer-thumbnails').boundingBox();
  assert.ok(
    photo.height > 300 && thumbs.x >= photo.x + photo.width,
    'landscape thumbnails sit beside a tall photo',
  );
  await page.screenshot({ path: `${output}/fullscreen-landscape.png` });
  await page.waitForTimeout(550);
  points = await imagePoints();
  await page.touchscreen.tap(points.center.x, points.center.y);
  assert.ok(await dialog.isVisible(), 'landscape image tap stays open');
  await page.touchscreen.tap(points.black.x, points.black.y);
  await dialog.waitFor({ state: 'hidden' });
  await openViewer();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await viewerDrag(0, 130);
  await dialog.waitFor({ state: 'hidden' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  const review = page.locator('.reviews article').first();
  await review.scrollIntoViewIfNeeded();
  assert.ok((await review.boundingBox()).width < 310);
  const reviews = page.locator('.review-grid:not(.duplicate) article');
  async function equalReviewHeights(min = 0, max = Number.MAX_VALUE) {
    await page.waitForFunction(
      ({ min, max }) => {
        const cards = [...document.querySelectorAll('.review-grid:not(.duplicate) article')];
        const heights = cards.map((card) => card.getBoundingClientRect().height);
        return (
          heights.length === 3 &&
          heights[0] > min &&
          heights[0] < max &&
          Math.max(...heights) - Math.min(...heights) < 1 &&
          cards.every(
            (card) =>
              card.querySelector('.review-content').getBoundingClientRect().bottom <=
              card.getBoundingClientRect().bottom -
                parseFloat(getComputedStyle(card).paddingBottom) +
                1,
          )
        );
      },
      { min, max },
    );
    for (const card of await reviews.all()) {
      assert.ok(
        await card.evaluate((node) => {
          const copy = node.querySelector('.review-content').getBoundingClientRect();
          return (
            copy.bottom <=
              node.getBoundingClientRect().bottom -
                parseFloat(getComputedStyle(node).paddingBottom) +
                1 && getComputedStyle(node).overflow === 'visible'
          );
        }),
        'all review content fits within the equal-height card without clipping',
      );
    }
    return (await review.boundingBox()).height;
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const collapsed = await equalReviewHeights();
    assert.ok(collapsed < 200, 'mobile review default height is reduced without losing read more');
    console.log(JSON.stringify({ reviewViewport: width, collapsedHeight: collapsed }));
    await review.locator('button.review-more').click();
    assert.ok(
      (await equalReviewHeights(collapsed + 200)) > collapsed + 200,
      'all cards grow to fit the full long review',
    );
    assert.ok(
      (await review.locator('.review-copy:not(.review-baseline)').textContent()).length > 600,
    );
    await review.locator('button.review-more').click();
    assert.ok(Math.abs((await equalReviewHeights(collapsed - 1, collapsed + 1)) - collapsed) < 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await equalReviewHeights();
  await review.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/reviews-portrait.png` });
  const banner = page.locator('.home-services .banner-background');
  await banner.scrollIntoViewIfNeeded();
  assert.ok((await banner.getAttribute('src')).includes('version-13-'));
  assert.equal(await page.locator('.service-versions, #service-background-versions').count(), 0);
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await desktop.route('**/*', (route) =>
    ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await desktop.goto(origin);
  const mapLink = desktop.locator('.map-link').first();
  await mapLink.scrollIntoViewIfNeeded();
  await mapLink.hover();
  const hover = await mapLink.evaluate((node) => ({
    underline: getComputedStyle(node).textDecorationLine,
    color: getComputedStyle(node).color,
    decoration: getComputedStyle(node).textDecorationColor,
    arrow: getComputedStyle(node.querySelector('svg')).color,
  }));
  assert.equal(hover.underline, 'underline');
  assert.equal(hover.color, hover.decoration);
  assert.equal(hover.arrow, 'rgb(255, 255, 255)');
  await desktop.close();
  console.log(
    'PASS: fullscreen background/image/control taps, downward completion/cancellation/finger tracking/fade, pinch and zoom preservation, viewport resize, reduced motion, portrait/landscape; native horizontal/vertical touch, drag feedback, touch/keyboard focus, share alignment, card inset/opacity, landscape layouts, mobile review sizing and equal heights at 320/390px, including full expanded text.',
  );
} finally {
  await browser?.close();
  vite.kill();
  backend.closeAllConnections();
  backend.close();
}
