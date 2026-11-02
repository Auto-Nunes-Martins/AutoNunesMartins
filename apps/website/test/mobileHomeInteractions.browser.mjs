// Real local homepage; no source fixtures or production mutations.
// node test/mobileHomeInteractions.browser.mjs http://localhost:5173/
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const url = new URL(process.argv[2]);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
const output = `.svelte-kit/mobile-home-${Date.now()}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const results = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: width === 390,
      hasTouch: width === 390,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.locator('.hd-landscape picture').waitFor();
    const zoom = await page.locator('.hd-landscape picture').evaluate((picture) => {
      const animation = picture
        .getAnimations()
        .find((a) => a.animationName === 'hd-v1-wallpaper-settle');
      return {
        duration: animation.effect.getTiming().duration,
        scales: animation.effect.getKeyframes().map((k) => k.scale),
      };
    });
    assert.equal(zoom.duration, 4800);
    assert.deepEqual(zoom.scales, ['1.055', '1']);
    await page.waitForTimeout(5000);
    const snapshot = () =>
      page.locator('.hd-landscape').evaluate((canvas) => {
        const r = canvas.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          inline: canvas.style.height,
        };
      });
    const initial = await snapshot();
    if (width === 390) {
      assert.notEqual(initial.inline, '');
      const crop = () =>
        page
          .locator('.hd-landscape img')
          .evaluate((image) => image.currentSrc.replace(/-\d+\.(avif|webp).*$/, '.$1'));
      const initialCrop = await crop();
      for (const height of [910, 844, 680, 844]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(100);
        assert.deepEqual(await snapshot(), initial);
        assert.equal(
          await crop(),
          initialCrop,
          'toolbar resize must not switch portrait crop at the 700px breakpoint',
        );
      }
      await page.evaluate(() => scrollTo(0, 50));
      await page.waitForTimeout(100);
      assert.deepEqual(await snapshot(), initial);
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(150);
      const rotated = await snapshot();
      assert.equal(rotated.width, 844);
      assert.notEqual(rotated.height, initial.height);
      await page.setViewportSize({ width: 844, height: 450 });
      await page.waitForTimeout(100);
      assert.deepEqual(await snapshot(), rotated);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      assert.equal((await snapshot()).width, 390);
    } else assert.equal(initial.inline, '', 'desktop keeps its CSS frame');
    await page.evaluate(() => {
      window.scrollCalls = [];
      const native = window.scrollTo.bind(window);
      window.scrollTo = (options) => {
        if (options.behavior === 'smooth') {
          const target = document.querySelector('#selecao'),
            header = document.querySelector('.design header').getBoundingClientRect();
          const margin = Math.max(
            parseFloat(getComputedStyle(target).scrollMarginTop) || 0,
            header.top <= 1 && header.bottom > 0 ? header.bottom + 20 : 0,
          );
          window.scrollCalls.push({
            top: options.top,
            base: Math.min(
              scrollY + target.getBoundingClientRect().top - margin,
              document.documentElement.scrollHeight - innerHeight,
            ),
          });
        }
        return native(options);
      };
      scrollTo({ top: 0, behavior: 'instant' });
    });
    const cue = page.locator('.hd-scroll'),
      target = page.locator('#selecao');
    if (width === 390) await cue.tap();
    else await cue.click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#selecao'));
    const call = await page.evaluate(() => window.scrollCalls.at(-1));
    assert.equal(call.top - call.base, width === 390 ? 5 : 0);
    assert.equal(await target.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await cue.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement === document.querySelector('#selecao'));
    assert.equal(await target.getAttribute('data-anchor-pointer-focus'), null);
    const cabin = page.locator('.cabin-link');
    await cabin.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const start = await page.evaluate(() => scrollY);
    await page.evaluate(() => {
      window.trip = [];
      window.sampleTrip = true;
      const sample = () => {
        if (!window.sampleTrip) return;
        window.trip.push({ t: performance.now(), y: scrollY });
        requestAnimationFrame(sample);
      };
      sample();
    });
    if (width === 390) await cabin.tap();
    else await cabin.click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#selecao'));
    const trip = await page.evaluate(() => {
      window.sampleTrip = false;
      return window.trip;
    });
    assert.ok(new Set(trip.map((p) => Math.round(p.y))).size > 10, 'return scroll is progressive');
    assert.ok(trip.at(-1).t - trip[0].t >= 1000, 'long return is not an immediate jump');
    assert.ok(trip.some((p) => p.y < start - 10 && p.y > trip.at(-1).y + 10));
    assert.equal(await target.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    if (width === 390) await cue.tap();
    else await cue.click();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#selecao'));
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/${width}.png` });
    results.push({
      width,
      zoom,
      initial,
      offset: call.top - call.base,
      returnDuration: trip.at(-1).t - trip[0].t,
    });
    console.log(`PASS homepage ${width}px`);
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
