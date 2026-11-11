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
import sharp from 'sharp';
import { progressiveHero } from './progressiveHero.mjs';
import { captureCarouselFrames, publicMotionCheck } from './publicMotionCheck.mjs';

const site = fileURLToPath(new URL('../', import.meta.url));
const streaming = process.argv.includes('--stream');
const interactions = process.argv.includes('--interactions');
const readingProfile = process.argv.includes('--reading-profile');
const output = path.join(
  site,
  '.svelte-kit',
  `${streaming ? 'hero-stream' : 'hero-layout'}-${Date.now()}`,
);
await mkdir(output, { recursive: true });
const photo = await sharp({
  create: { width: 1600, height: 1067, channels: 3, background: '#63756b' },
})
  .png()
  .toBuffer();
const nextPhoto = interactions
  ? await sharp({ create: { width: 1600, height: 1067, channels: 3, background: '#846052' } })
      .png()
      .toBuffer()
  : photo;
const vehicles = ['One', 'Countryman Cooper D ALL4 Automatic'].map((model, n) => ({
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
const backend = createServer((request, response) => {
  const url = new URL(request.url, 'http://fixture');
  if (url.pathname.includes('/photos/')) {
    response.setHeader('content-type', 'image/png');
    const second = url.pathname.includes('hero-check-aaaaaaaaaaa1');
    response.setHeader('x-photo-version', (second ? '2' : '1').repeat(64));
    response.end(second ? nextPhoto : photo);
    return;
  }
  let data;
  if (url.pathname.endsWith('/homepage-highlights'))
    data = { configured: true, items: vehicles.map((vehicle) => ({ vehicle, photoIndex: 0 })) };
  else if (url.pathname.endsWith('/brands')) data = [];
  else if (url.pathname.endsWith('/reviews')) data = { items: [] };
  else if (url.pathname.endsWith('/related')) data = [];
  else if (vehicles.some((vehicle) => url.pathname.endsWith('/' + vehicle.slug)))
    data = vehicles.find((vehicle) => url.pathname.endsWith('/' + vehicle.slug));
  else
    data = {
      // Leave the second highlight out of stock previews so its first request
      // comes from the carousel, where the browser test can delay it.
      items: interactions ? vehicles.slice(0, 1) : vehicles,
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
const server = spawn(process.execPath, ['build/index.js'], {
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
});
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
  if (streaming) progressive = await progressiveHero(origin);
  const profiles =
    interactions || readingProfile
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
        await page.locator('.orbit-stats.entered').waitFor();
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
        const labels = frames.filter((frame) => Number.isFinite(frame.statLabelY));
        assert.ok(labels.length > 1, 'Observe the visible statistic label before and after entry');
        for (let index = 1; index < labels.length; index++) {
          assert.ok(
            labels[index].statLabelY - labels[index - 1].statLabelY < 0.1,
            `${width}px ${phase}: statistic label jumped down before entering`,
          );
          assert.ok(
            labels[index].statOpacity >= labels[index - 1].statOpacity - 0.01,
            `${width}px ${phase}: visible statistic label flashed during entry`,
          );
        }
        const finalLabel = labels.at(-1);
        assert.ok(
          Math.abs(finalLabel.statOffset) < 0.1,
          'Statistic entry must finish at its normal layout position',
        );
        assert.equal(finalLabel.statOpacity, 1, 'Statistic entry must finish fully visible');
        console.log(
          `${width}px font+${fontDelay} ${reducedMotion} ${phase}${streaming ? ` CSS+${profile.cssDelay} split:${profile.split}` : ''}: stable`,
        );
      }
    } finally {
      await context.close();
    }
  }
  if (!interactions) console.log(`${results.length} profiles passed; evidence: ${output}`);
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
