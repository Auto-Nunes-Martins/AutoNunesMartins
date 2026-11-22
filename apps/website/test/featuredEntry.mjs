import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

export const featuredFraming = {
  desktop: { x: 27, y: 81, zoom: 1.35, fit: 'cover' },
  mobile: { x: 72, y: 19, zoom: 1.2, fit: 'cover' },
};

function gate() {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  return { promise, release };
}

// Run with "node test/heroLayout.browser.mjs --featured-entry" against the local build.
export async function checkFeaturedEntry(browser, origin, photo, delayHighlights) {
  for (const width of [1440, 390]) {
    const mobile = width === 390;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      for (const phase of ['cold', 'reload']) {
        const scripts = gate();
        const picture = gate();
        const routeTraffic = async (route) => {
          const url = new URL(route.request().url());
          if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
          if (url.pathname.includes('/photos/') && !url.pathname.endsWith('/access')) {
            await picture.promise;
            return route.fulfill({ contentType: 'image/png', body: photo });
          }
          if (route.request().resourceType() === 'script') await scripts.promise;
          return route.continue();
        };
        await page.route('**/*', routeTraffic);
        try {
          if (phase === 'cold') await page.goto(origin, { waitUntil: 'commit' });
          else await page.reload({ waitUntil: 'commit' });
          const card = page.locator('.hd-feature[role="region"]');
          const photoStage = card.locator('.hd-photo-stage');
          const image = card.locator('.hd-photo img').first();
          await image.waitFor({ state: 'attached' });
          await expect
            .poll(() =>
              page.evaluate(() => performance.getEntriesByName('first-contentful-paint').length),
            )
            .toBeGreaterThan(0);
          const position = featuredFraming[mobile ? 'mobile' : 'desktop'];
          const crop = `${position.x}% ${position.y}%`;
          await expect(image).toHaveCSS('object-position', crop);
          const visible = (node) =>
            node.checkVisibility({ opacityProperty: true, visibilityProperty: true });
          assert.equal(await image.evaluate((node) => node.naturalWidth), 0);
          assert.equal(
            await photoStage.evaluate(visible),
            false,
            'The photo frame must wait for the first photo',
          );
          picture.release();
          await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
          await expect.poll(() => photoStage.evaluate(visible)).toBe(true);
          const pose = () =>
            image.evaluate((node) => {
              const style = getComputedStyle(node);
              return {
                y: node.getBoundingClientRect().top,
                position: style.objectPosition,
                zoom: new DOMMatrixReadOnly(style.transform).a,
              };
            });
          const before = await pose();
          assert.equal(before.position, crop);
          assert.ok(Math.abs(before.zoom - position.zoom) < 0.001);
          scripts.release();
          await page.locator('.hd-root[data-canvas-pinned]').waitFor();
          // Sample the entire former entry animation, including any intermediate recentering.
          for (let i = 0; i < 12; i++) {
            const sample = await pose();
            assert.equal(sample.position, crop);
            assert.ok(Math.abs(sample.zoom - before.zoom) < 0.001);
            assert.ok(
              Math.abs(sample.y - before.y) < 0.5,
              `${width}px ${phase}: featured photo moved`,
            );
            await page.waitForTimeout(180);
          }
        } finally {
          picture.release();
          scripts.release();
          await page.unrouteAll({ behavior: 'wait' });
        }
      }
      if (!mobile) {
        const phone = page.locator('.nav-phone');
        const rings = () =>
          phone
            .locator('svg')
            .evaluate(
              (icon) =>
                icon.getAnimations().filter((animation) => !('animationName' in animation)).length,
            );
        await phone.hover();
        assert.equal(await rings(), 1, 'Pointer entry starts the ring over the idle CSS animation');
        await expect.poll(rings).toBe(0);
        await page.mouse.move(0, 0);
        await phone.focus();
        assert.equal(await rings(), 1, 'Keyboard focus starts the ring');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect.poll(rings).toBe(0);
        await phone.hover();
        assert.equal(await rings(), 0, 'Reduced motion suppresses the ring');

        // Enter from another document so the homepage parser has never run.
        await page.goto(origin + '/quem-somos');
        const highlights = gate();
        delayHighlights(highlights.promise);
        try {
          await page.locator('.stand-header a[href="/"]').first().click();
          const pending = page.locator('.hd-skeleton');
          await expect(pending).toBeVisible();
          await expect(pending.locator('.hd-photo-stage')).toHaveCSS('opacity', '0');
        } finally {
          highlights.release();
          delayHighlights(undefined);
        }
        await expect(page.locator('.hd-feature[role="region"] .hd-photo-stage')).toHaveCSS(
          'opacity',
          '1',
        );
      }
      assert.deepEqual(errors, []);
      console.log(
        `Featured photo framing and entry passed at ${width}px on first visit and reload.`,
      );
    } finally {
      await context.close();
    }
  }
}
