// Run after the website build: node test/heroLayout.browser.mjs
// Progressive HTML/CSS regression: node test/heroLayout.browser.mjs --stream
// Local synthetic backend only. Keep artifacts; never clean a checkout or dependencies.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { expect } from '@playwright/test';
import sharp from 'sharp';
import { progressiveHero } from './progressiveHero.mjs';
import { captureCarouselFrames, publicMotionCheck } from './publicMotionCheck.mjs';

const site = fileURLToPath(new URL('../', import.meta.url));
const streaming = process.argv.includes('--stream');
const interactions = process.argv.includes('--interactions');
const readingProfile = process.argv.includes('--reading-profile');
const cardPromotionPreview = process.argv.includes('--card-promotion-preview');
const campaignPreview = process.argv.includes('--campaign-preview') || cardPromotionPreview;
const productionCampaignCheck = process.argv.includes('--production-campaigns');
const output = path.join(
  site,
  '.svelte-kit',
  `${streaming ? 'hero-stream' : 'hero-layout'}-${Date.now()}`,
);
await mkdir(output, { recursive: true });
const photo = await (
  campaignPreview
    ? sharp(path.join(site, 'static/images/about/showroom-demo-v1-960.webp'))
    : sharp({
        create: { width: 1600, height: 1067, channels: 3, background: '#63756b' },
      })
)
  .png()
  .toBuffer();
const nextPhoto = campaignPreview
  ? await sharp(path.join(site, 'static/images/about/preparation-demo-v1-960.webp'))
      .png()
      .toBuffer()
  : interactions
    ? await sharp({ create: { width: 1600, height: 1067, channels: 3, background: '#846052' } })
        .png()
        .toBuffer()
    : photo;
const vehicles = (
  campaignPreview
    ? ['Série 3 Touring', 'Countryman Cooper D']
    : ['One', 'Countryman Cooper D ALL4 Automatic']
).map((model, n) => ({
  slug: `hero-check-${String(n).padStart(12, 'a')}`,
  brand: n ? 'MINI' : 'BMW',
  model,
  year: interactions && n ? 2017 : 2021,
  fuel: interactions && n ? 'PLUGIN_HYBRID' : 'DIESEL',
  mileage: interactions && n ? 187250 : 40000,
  price: interactions && n ? '24900.00' : interactions ? '9500.00' : '23500.00',
  currency: 'EUR',
  description: interactions
    ? '<!--anm:rich-description:v1-->' +
      '<p>Histórico, manutenção e equipamento da viatura em exposição.</p>'.repeat(24) +
      '<p><a href="https://example.test/vehicle">Ver ficha técnica</a></p>'
    : 'Local layout regression fixture.',
  transmission: 'AUTOMATIC',
  availability: interactions && n ? 'RESERVED' : 'AVAILABLE',
  photos: [
    `/api/public/vehicles/hero-check-${String(n).padStart(12, 'a')}/photos/0?v=${String(n + 1).repeat(64)}`,
  ],
}));
let showCampaigns = campaignPreview || productionCampaignCheck;
let campaignRequests = 0;
const promoted = [
  {
    ...vehicles[0],
    price: '21900.00',
    promotion: {
      referencePrice: '23500.00',
      startsAt: '2026-11-11T09:00:00.000Z',
      endsAt: '2026-11-18T09:00:00.000Z',
    },
  },
];
const selected = { ...vehicles[1], price: '19900.00', priceValidUntil: '2026-11-18T23:59:00.000Z' };
let selectionCount = 1;
let campaignCount = 1;
const backend = createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture');
  if (url.pathname.endsWith('/campaigns')) campaignRequests++;
  if (url.pathname.includes('/photos/')) {
    response.setHeader('content-type', 'image/png');
    const second = url.pathname.includes('hero-check-aaaaaaaaaaa1');
    response.setHeader('x-photo-version', (second ? '2' : '1').repeat(64));
    response.end(second ? nextPhoto : photo);
    return;
  }
  let data;
  const inventory = showCampaigns ? [...promoted, selected] : vehicles;
  if (url.pathname.endsWith('/homepage-highlights'))
    data = { configured: true, items: inventory.map((vehicle) => ({ vehicle, photoIndex: 0 })) };
  else if (url.pathname.endsWith('/campaigns'))
    data = showCampaigns
      ? {
          items: Array.from({ length: campaignCount }, (_, index) => {
            const slug = 'hero-check-' + String(index + 8).padStart(12, 'a');
            if (!index) return promoted[0];
            return {
              ...promoted[0],
              slug,
              brand: ['BMW', 'MINI', 'Volkswagen', 'Audi'][index],
              model: ['Série 3 Touring', 'Countryman Cooper D', 'Golf 1.6 TDI', 'A3 Sportback'][
                index
              ],
              photos: promoted[0].photos.map((photo) => photo.replace(promoted[0].slug, slug)),
            };
          }),
          selection: Array.from({ length: selectionCount }, (_, index) => {
            if (!index) return selected;
            const slug = 'hero-check-' + String(index + 2).padStart(12, 'a');
            return {
              ...selected,
              slug,
              photos: selected.photos.map((photo) => photo.replace(selected.slug, slug)),
            };
          }),
        }
      : { items: [], selection: [] };
  else if (url.pathname.endsWith('/brands')) data = [];
  else if (url.pathname.endsWith('/reviews')) data = { items: [] };
  else if (url.pathname.endsWith('/related')) data = [];
  else if (inventory.some((vehicle) => url.pathname.endsWith('/' + vehicle.slug)))
    data = inventory.find((vehicle) => url.pathname.endsWith('/' + vehicle.slug));
  else
    data = {
      // Leave the second highlight out of stock previews so its first request
      // comes from the carousel, where the browser test can delay it.
      items: interactions ? inventory.slice(0, 1) : inventory,
      total: interactions ? 1 : vehicles.length,
      page: 1,
      pageSize: 30,
      totalPages: 1,
      facets: {
        brands: [],
        models: [],
        fuels: [],
        transmissions: [],
        year: { min: null, max: null },
        price: { min: null, max: null },
        mileage: { min: null, max: null },
      },
    };
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(data));
});
await new Promise((resolve) => backend.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${backend.address().port}`;
const reserve = createServer();
await new Promise((resolve) => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise((resolve) => reserve.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  campaignPreview
    ? ['../../node_modules/vite/bin/vite.js', 'dev', '--host', '127.0.0.1', '--port', String(port)]
    : ['build/index.js'],
  {
    cwd: site,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      ORIGIN: origin,
      PUBLIC_BACKEND_URL: api,
      INTERNAL_BACKEND_URL: api,
    },
    stdio: 'pipe',
    windowsHide: true,
  },
);
let logs = '';
server.stdout.on('data', (data) => (logs += data));
server.stderr.on('data', (data) => (logs += data));
let browser;
let progressive;
const results = [];
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {
      /* Wait for this child only. */
    }
    if (attempt > 80 || server.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = process.argv.includes('--webkit')
    ? await webkit.launch()
    : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  if (productionCampaignCheck) {
    const response = await fetch(origin);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(!html.includes('id="campanhas"'));
    assert.ok(!html.includes('id="selecao-do-stand"'));
    assert.ok(!/<div[^>]*class="card-promotion(?:\s|")/.test(html));
    assert.ok(!html.includes('class="card-promotion-overlay'));
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      await page.goto(origin);
      await expect(page.locator('#selecao')).toBeVisible();
      await expect(page.locator('#campanhas')).toHaveCount(0);
      await expect(page.locator('#selecao-do-stand')).toHaveCount(0);
      await expect(page.locator('.card-promotion')).toHaveCount(0);
      await expect(page.locator('.card-promotion-overlay')).toHaveCount(0);
      await expect(page.locator('.card-price').first()).toContainText(/21\s*900/);
      await page.goto(origin + '/viaturas');
      await expect(page.locator('.card-promotion')).toHaveCount(0);
      await expect(page.locator('.card-promotion-overlay')).toHaveCount(0);
      await expect(page.locator('.card-price').first()).toContainText(/21\s*900/);
      await page.close();
    }
    assert.equal(campaignRequests, 0, 'Production must not load the optional campaign section');
    console.log(
      'Production campaign section and card promotion details hidden; selling prices preserved.',
    );
  }
  if (readingProfile) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await page.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    await page.goto(origin);
    await page.locator('.design.motion-on').waitFor();
    const stats = await page.locator('.read-line').evaluate(async (bar) => {
      await document.fonts.ready;
      const original = Element.prototype.getBoundingClientRect;
      let reads = 0,
        readTime = 0,
        writes = 0,
        events = 0;
      Element.prototype.getBoundingClientRect = function () {
        if (!this.matches('[data-scene]')) return original.call(this);
        const start = performance.now();
        const bounds = original.call(this);
        readTime += performance.now() - start;
        reads++;
        return bounds;
      };
      const onScroll = () => events++;
      window.addEventListener('scroll', onScroll);
      const observer = new MutationObserver((records) => (writes += records.length));
      observer.observe(bar, { attributes: true, attributeFilter: ['style'] });
      const nextFrame = () => new Promise(requestAnimationFrame);
      const expected = () =>
        scrollY /
        Math.max(
          1,
          document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight,
        );
      const actual = () => new DOMMatrixReadOnly(getComputedStyle(bar).transform).a;
      try {
        const errors = [];
        for (let frame = 0; frame < 32; frame++) {
          scrollTo({ top: frame * 46, behavior: 'instant' });
          await nextFrame();
          errors.push(Math.abs(expected() - actual()));
        }
        await nextFrame();
        const endError = Math.abs(expected() - actual());
        const spacer = document.createElement('div');
        spacer.style.height = '1300px';
        bar.parentElement.append(spacer);
        await nextFrame();
        await nextFrame();
        return {
          native: CSS.supports('animation-timeline: scroll(root block)'),
          reads,
          readTime,
          writes,
          events,
          peakError: Math.max(...errors),
          endError,
          grownError: Math.abs(expected() - actual()),
        };
      } finally {
        Element.prototype.getBoundingClientRect = original;
        window.removeEventListener('scroll', onScroll);
        observer.disconnect();
      }
    });
    console.log(browser.browserType().name(), stats);
    assert.ok(stats.events > 20 && stats.endError < 0.001 && stats.grownError < 0.001);
    if (!process.argv.includes('--baseline') && stats.native) assert.equal(stats.writes, 0);
    await page.setViewportSize({ width: 430, height: 790 });
    await page.waitForFunction(() => {
      const bar = document.querySelector('.read-line');
      const scroller = document.scrollingElement;
      const expected = scrollY / Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      return Math.abs(new DOMMatrixReadOnly(getComputedStyle(bar).transform).a - expected) < 0.001;
    });
    await page.close();
  }
  if (interactions) {
    if (process.argv.includes('--frames')) await captureCarouselFrames(browser, origin, output);
    else await publicMotionCheck(browser, origin, vehicles[0].slug);
  }
  if (campaignPreview) {
    for (const width of cardPromotionPreview ? [1440, 390, 320] : [1440, 1024, 768, 390, 320]) {
      selectionCount = 1;
      campaignCount = 1;
      const page = await browser.newPage({
        viewport: { width, height: 950 },
        isMobile: width < 700,
        hasTouch: width < 700,
        reducedMotion: 'reduce',
      });
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      await page.goto(origin);
      const section = page.getByRole('region', { name: /Campanhas/ });
      const promotionalPrice = page.locator('.card-promotion').first();
      const promotedCard = promotionalPrice.locator('xpath=ancestor::article');
      await expect(promotionalPrice).not.toContainText(/Antes|Agora/);
      await expect(promotionalPrice.locator('s.previous-price')).toContainText(/23\s*500/);
      await expect(promotionalPrice.locator('strong.current-price')).toContainText(/21\s*900/);
      await expect(promotedCard.locator('.card-image .promotion-remaining')).toHaveAttribute(
        'aria-label',
        /Termina em.*\d+min/,
        { timeout: 15000 },
      );
      await expect(promotedCard.locator('.card-image .mini-unit')).toHaveCount(4);
      await expect(promotedCard.locator('.card-image .mini-sheet')).toHaveCount(0);
      await expect(promotedCard.locator('.card-image .promotion-ribbon')).toHaveCount(1);
      await expect(promotedCard.locator('.card-image .leaf')).toHaveCount(0);
      await expect(promotedCard.locator('.card-image .promotion-discount')).toContainText(
        /1600\s*€|1\s*600\s*€/,
      );
      await expect(promotionalPrice).not.toContainText('Preço base');
      if (cardPromotionPreview) {
        const card = promotionalPrice.locator('xpath=ancestor::article');
        for (const theme of ['dark', 'light']) {
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          await card.scrollIntoViewIfNeeded();
          await expect(card.locator('.card-specs')).toContainText('2021');
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          const screenshot = path.join(output, `normal-promotion-${theme}-${width}.png`);
          await card.screenshot({ path: screenshot, animations: 'disabled' });
          console.log(screenshot);
        }
        await page.close();
        continue;
      }
      await expect(section.locator('article')).toHaveCount(1);
      await expect(section.locator('article').first()).toContainText(/21\s*900/);
      await expect(section.locator('article').first()).toContainText(/23\s*500/);
      await expect(section.locator('time')).toHaveCount(1);
      await expect(section.locator('.specs:visible')).toContainText('2021');
      await expect(section.locator('.specs:visible')).toContainText(/40\s*000/);
      await expect(section.locator('.specs:visible')).toContainText('Diesel');
      await expect(section.locator('.countdown-unit')).toHaveCount(4, { timeout: 15000 });
      if (width === 1440) {
        const initialCountdown = await section.locator('time').textContent();
        await expect.poll(() => section.locator('time').textContent()).not.toBe(initialCountdown);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect(section.locator('.motion-toggle')).toHaveCount(0);
        const ticker = section.locator('.ticker-track');
        await section.locator('.ticker-window').hover();
        assert.equal(
          await ticker.evaluate((node) => getComputedStyle(node).animationPlayState),
          'running',
        );
        const initialTickerPosition = await ticker.evaluate(
          (node) => getComputedStyle(node).transform,
        );
        await expect
          .poll(() => ticker.evaluate((node) => getComputedStyle(node).transform))
          .not.toBe(initialTickerPosition);
        await page.emulateMedia({ reducedMotion: 'reduce' });
      }
      await expect(section.getByText(selected.model)).toHaveCount(0);
      const selection = page.getByRole('region', { name: 'Seleção do stand' });
      await expect(selection.locator('article')).toHaveCount(1);
      await expect(selection.locator('article a')).toHaveAttribute(
        'href',
        '/viaturas/' + selected.slug,
      );
      await expect(selection.locator('article a')).toContainText(/19\s*900/);
      await expect(selection.locator('time')).toHaveAttribute('datetime', selected.priceValidUntil);
      await expect(section.locator('.reduction')).toContainText(/1600\s*€|1\s*600\s*€/);
      await expect(selection.locator('.promotion-terms')).toHaveCount(0);
      await expect(selection).not.toContainText(/promoção|desconto|sale/i);
      assert.ok(
        await selection.evaluate(
          (node) =>
            !!(
              node.compareDocumentPosition(document.querySelector('#selecao')) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await section.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      const campaignCardSize = await section.locator('article').first().boundingBox();
      await expect(section.locator('h2')).toContainText('Oferta');
      await expect(section.locator('h2')).not.toContainText('Ofertas');
      const singleRailWidth = await section.locator('.campaign-rail').evaluate((node) => {
        const css = getComputedStyle(node);
        return node.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
      });
      assert.ok(Math.abs(campaignCardSize.width - singleRailWidth) < 2, 'One offer fills the rail');
      const screenshot = path.join(output, `campanhas-site-${width}.png`);
      await section.screenshot({ path: screenshot, animations: 'disabled' });
      console.log(screenshot);
      await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
      await section.screenshot({
        path: path.join(output, `campanhas-single-light-${width}.png`),
        animations: 'disabled',
      });
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      await selection.screenshot({
        path: path.join(output, `selecao-site-${width}.png`),
        animations: 'disabled',
      });
      await page.goto(origin + '/viaturas/' + promoted[0].slug);
      await expect(page.locator('.purchase-price')).toContainText(/21\s*900/);
      await expect(page.locator('.purchase .promotion-terms')).toContainText(/23\s*500/);
      await page.goto(origin + '/viaturas/' + selected.slug);
      await expect(page.locator('.purchase-price')).toContainText(/19\s*900/);
      await expect(page.locator('.purchase .promotion-terms')).toHaveCount(0);

      for (const count of [2, 3, 4]) {
        selectionCount = count;
        campaignCount = count;
        await page.goto(origin);
        await expect(selection.locator('article')).toHaveCount(count);
        await expect(section.locator('article')).toHaveCount(count);
        await expect(section.locator('.countdown-unit')).toHaveCount(count * 4);
        const currentCardSize = await section.locator('article').first().boundingBox();
        await expect(section.locator('h2')).toContainText('Ofertas');
        if (count === 2) {
          const rail = await section.locator('.campaign-rail').evaluate((node) => {
            const css = getComputedStyle(node);
            return {
              width: node.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight),
              gap: parseFloat(css.columnGap),
            };
          });
          assert.ok(
            width > 700
              ? Math.abs(currentCardSize.width * 2 + rail.gap - rail.width) < 2
              : Math.abs(currentCardSize.width - rail.width * 0.88) < 2,
            'Two offers fill equal columns on desktop and retain a compact mobile carousel',
          );
          if (width > 700) await expect(section.locator('.rail-controls')).toBeHidden();
          else await expect(section.locator('.rail-controls')).toBeVisible();
          await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
          await section.screenshot({
            path: path.join(output, `campanhas-pair-light-${width}.png`),
            animations: 'disabled',
          });
          await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
        } else if (width > 1100) {
          const railWidth = await section
            .locator('.campaign-rail')
            .evaluate((node) => node.clientWidth - 12);
          assert.ok(
            Math.abs(currentCardSize.width * count + (count - 1) * 20 - railWidth) < 2,
            'Three or four desktop cards should fill the available rail width',
          );
        }
        if (count === 2) {
          assert.ok(
            Math.abs(currentCardSize.height - campaignCardSize.height - (width > 700 ? 24 : 12)) <
              1,
            'Two offers gain a little photo height over the shorter single offer',
          );
        } else {
          assert.ok(
            currentCardSize.height > campaignCardSize.height + 20,
            'One and two offers are shorter than the unchanged three/four-card layout',
          );
        }
        await expect(section.locator('s').first()).toContainText(/23\s*500/);
        if (width === 1440 && count === 4) {
          assert.ok(
            await section
              .locator('.campaign-rail')
              .evaluate((node) => node.scrollWidth <= node.clientWidth + 2),
            'Four desktop campaign cards must fit without scrolling',
          );
        }
        if (count === 4 && width <= 1024) {
          await section.getByRole('button', { name: 'Campanha seguinte' }).click();
          await expect
            .poll(() => section.locator('.campaign-rail').evaluate((node) => node.scrollLeft))
            .toBeGreaterThan(0);
        }
        await section.scrollIntoViewIfNeeded();
        await section.screenshot({
          path: path.join(output, 'campanhas-' + count + '-' + width + '.png'),
          animations: 'disabled',
        });
        if (width < 700) {
          await section.locator('article').last().scrollIntoViewIfNeeded();
          await expect(section.locator('article').last()).toBeInViewport();
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      await page.close();
    }
    showCampaigns = false;
    const page = await browser.newPage();
    await page.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    await page.goto(origin);
    await expect(page.getByRole('region', { name: /Campanhas/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Seleção do stand' })).toHaveCount(0);
    await page.close();
    console.log(
      cardPromotionPreview
        ? 'Normal promotion cards passed in both themes at 1440px, 390px and 320px.'
        : 'Campaign section passed at all five widths, including the empty state.',
    );
  }
  if (streaming) progressive = await progressiveHero(origin);
  const profiles =
    interactions || readingProfile || campaignPreview || productionCampaignCheck
      ? []
      : streaming
        ? [
            ...[1440, 390].flatMap((width) =>
              [0, 650].map((cssDelay) => ({ width, cssDelay, split: 'hero' })),
            ),
            { width: 390, cssDelay: 0, split: 'stats' },
          ]
        : [1440, 390].flatMap((width) =>
            [0, 650].flatMap((fontDelay) =>
              ['no-preference', 'reduce'].map((reducedMotion) => ({
                width,
                fontDelay,
                reducedMotion,
              })),
            ),
          );
  for (const profile of profiles) {
    const { width, fontDelay = 0, reducedMotion = 'no-preference' } = profile;
    progressive?.configure({ ...profile, tailDelay: 1200 });
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      deviceScaleFactor: 1,
      isMobile: width === 390,
      hasTouch: width === 390,
      reducedMotion,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let scriptsReady;
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
        if (!streaming && route.request().resourceType() === 'script') {
          scriptsReady ??= new Promise((resolve) => setTimeout(resolve, 1500));
          await scriptsReady;
        }
        if (/woff2$/.test(url.pathname) && fontDelay)
          await new Promise((resolve) => setTimeout(resolve, fontDelay));
        if (url.pathname.includes('/photos/') && !url.pathname.endsWith('/access')) {
          if (!streaming) await new Promise((resolve) => setTimeout(resolve, 1000));
          return route.fulfill({ contentType: 'image/png', body: photo });
        }
        return route.continue();
      });
      await page.addInitScript(() => {
        window.heroLayoutProbe = { frames: [], shifts: [], reserveWrites: [] };
        let previousReserve = '';
        new MutationObserver(() => {
          const hero = document.querySelector('.hd-root');
          const value = hero?.style.getPropertyValue('--v5-feature-height');
          if (value && value !== previousReserve) {
            previousReserve = value;
            window.heroLayoutProbe.reserveWrites.push({ time: performance.now(), value });
          }
        }).observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style'],
        });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.heroLayoutProbe.shifts.push({
              time: entry.startTime,
              value: entry.value,
              recentInput: entry.hadRecentInput,
            });
        }).observe({ type: 'layout-shift', buffered: true });
        function sample() {
          const hero = document.querySelector('.hd-root');
          if (hero) {
            const rect = hero.getBoundingClientRect();
            const landscape = hero.querySelector('.hd-landscape').getBoundingClientRect();
            const stats = document.querySelector('.orbit-stats');
            const stat = stats?.querySelector('.stat');
            const grid = stats?.querySelector('.stats-grid');
            const label = stat?.querySelector('p');
            const feature = hero.querySelector('.hd-feature');
            const photo = hero.querySelector('.hd-photo img');
            window.heroLayoutProbe.frames.push({
              time: performance.now(),
              painted: performance
                .getEntriesByType('paint')
                .some((entry) => entry.name === 'first-contentful-paint'),
              finalInitializerPresent: [...document.scripts].some(
                (script) => script.textContent.trim() === 'window.initializeOrbitDocument();',
              ),
              height: rect.height,
              nextY: hero.nextElementSibling?.getBoundingClientRect().top,
              headerHeight: document.querySelector('header')?.getBoundingClientRect().height,
              landscapeHeight: landscape.height,
              landscapeY: landscape.y,
              featureY: feature.getBoundingClientRect().top,
              featureOpacity: Number(getComputedStyle(feature).opacity),
              featureTranslate: getComputedStyle(feature).translate,
              photoY: photo?.getBoundingClientRect().top,
              photoHeight: photo?.getBoundingClientRect().height,
              photoOpacity: photo ? Number(getComputedStyle(photo).opacity) : undefined,
              motionOn: !!hero.closest('.motion-on'),
              statLabelY: label?.getBoundingClientRect().top,
              statOffset:
                stat && grid && stats
                  ? stat.getBoundingClientRect().top -
                    stats.getBoundingClientRect().top -
                    parseFloat(getComputedStyle(stats).borderTopWidth) -
                    parseFloat(getComputedStyle(grid).paddingTop)
                  : undefined,
              statOpacity: stat ? Number(getComputedStyle(stat).opacity) : undefined,
              hydrated: hero.hasAttribute('data-canvas-pinned'),
              fonts: document.fonts.status,
            });
          }
          if (performance.now() < 10000) requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      });
      for (const phase of streaming ? ['cold'] : ['cold', 'reload']) {
        scriptsReady = undefined;
        if (phase === 'cold')
          await page.goto(progressive?.origin ?? origin, { waitUntil: 'domcontentloaded' });
        else await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('.hd-feature').waitFor();
        await page.locator('.hd-root[data-canvas-pinned]').waitFor();
        await page.locator('.orbit-stats').waitFor({ state: 'attached' });
        await page.evaluate(async () => {
          const stat = document.querySelector('.orbit-stats .stat');
          await Promise.all(
            stat.getAnimations().map((animation) => animation.finished.catch(() => {})),
          );
        });
        await page.waitForTimeout(350);
        const result = {
          ...profile,
          width,
          fontDelay,
          reducedMotion,
          phase,
          errors: [...errors],
          delivery: progressive?.delivery(),
          ...(await page.evaluate(() => ({
            ...window.heroLayoutProbe,
            timeOrigin: performance.timeOrigin,
            paint: performance
              .getEntriesByType('paint')
              .map((entry) => ({ name: entry.name, time: entry.startTime })),
          }))),
        };
        results.push(result);
        await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        assert.deepEqual(errors, [], 'The real page must hydrate without browser errors');
        assert.ok(
          result.frames.some((frame) => !frame.hydrated),
          'Observe SSR before hydration',
        );
        assert.ok(
          result.frames.some((frame) => frame.hydrated),
          'Observe hydrated layout',
        );
        const frames = streaming ? result.frames.filter((frame) => frame.painted) : result.frames;
        assert.ok(frames.length > 1, 'Observe rendered geometry');
        if (streaming) {
          const firstPaint = result.paint.find(
            (entry) => entry.name === 'first-contentful-paint',
          )?.time;
          assert.ok(Number.isFinite(firstPaint), 'Observe the first contentful paint');
          assert.equal(
            result.delivery.originalSha256,
            result.delivery.rejoinedSha256,
            'Preserve every HTML byte',
          );
          assert.ok(result.delivery.markerInPrefix && result.delivery.initializerInSuffix);
          assert.ok(
            result.timeOrigin + firstPaint < result.delivery.tailEpoch,
            'The prefix must paint before the tail arrives',
          );
          assert.ok(
            result.reserveWrites[0]?.time < firstPaint,
            'Reserve the hero before its first paint',
          );
          assert.ok(
            frames.some((frame) => !frame.finalInitializerPresent),
            'Observe the painted prefix without the final initializer',
          );
        }
        for (const dimension of [
          'height',
          'nextY',
          'headerHeight',
          'landscapeHeight',
          'landscapeY',
        ]) {
          const observed = frames.map((frame) => frame[dimension]);
          const values = streaming ? observed.filter(Number.isFinite) : observed;
          assert.ok(values.length > 1, `${dimension} must have multiple samples`);
          assert.ok(values.every(Number.isFinite), `${dimension} must be observable`);
          assert.ok(
            Math.max(...values) - Math.min(...values) < 0.1,
            `${width}px ${phase}: ${dimension} moved during loading`,
          );
        }
        for (let index = 1; streaming && index < frames.length; index++) {
          assert.ok(
            frames[index].featureY - frames[index - 1].featureY < 0.1,
            `${width}px ${phase}: visible featured card snapped down`,
          );
          assert.ok(
            frames[index].featureOpacity >= frames[index - 1].featureOpacity - 0.01,
            `${width}px ${phase}: visible featured card flashed after entry`,
          );
        }
        // Trust metrics follow the hero and precede the vehicle selection in production.
        await page.locator('.orbit-stats').scrollIntoViewIfNeeded();
        await page.locator('.orbit-stats.entered').waitFor();
        await expect(page.locator('.orbit-stats + #selecao')).toHaveCount(1);
        await page.evaluate(async () => {
          const stat = document.querySelector('.orbit-stats .stat');
          await Promise.all(
            stat.getAnimations().map((animation) => animation.finished.catch(() => {})),
          );
        });
        await expect(page.locator('.orbit-stats .stat').first()).toHaveCSS('opacity', '1');
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        console.log(
          `${width}px font+${fontDelay} ${reducedMotion} ${phase}${streaming ? ` CSS+${profile.cssDelay} split:${profile.split}` : ''}: stable`,
        );
      }
    } finally {
      await context.close();
    }
  }
  if (!interactions && !campaignPreview) {
    console.log(`${results.length} profiles passed; evidence: ${output}`);
  }
} finally {
  await browser?.close();
  await progressive?.close();
  if (server.exitCode === null) {
    const closed = new Promise((resolve) => server.once('close', resolve));
    server.kill();
    await closed;
  }
  await new Promise((resolve) => backend.close(resolve));
}
