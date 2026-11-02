// Real local page, real public data/DOM. No fixtures or authenticated writes.
// Run from apps/website: node test/vehicleInteractions.browser.mjs http://localhost:5173/viaturas/<slug>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

const url = new URL(process.argv[2]);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert.ok(url.pathname.startsWith('/viaturas/'));
const output = `.svelte-kit/vehicle-interactions-${Date.now()}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL || 'chrome',
});
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 950 },
      isMobile: width === 390,
      hasTouch: width === 390,
      recordVideo: { dir: output },
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const cdp = width === 390 ? await context.newCDPSession(page) : undefined;
    const begin = async (x, y) => {
      if (cdp)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      else {
        await page.mouse.move(x, y);
        await page.mouse.down();
      }
    };
    const move = async (x, y) => {
      if (cdp) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        await page.waitForTimeout(20);
      } else await page.mouse.move(x, y, { steps: 3 });
    };
    const end = async () => {
      if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
    };
    const activate = (locator) => (cdp ? locator.tap() : locator.click());
    const selected = () =>
      page.locator('.detail-thumbnails button[aria-pressed=true]').getAttribute('aria-label');
    const drag = async (locator, distance) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox(),
        x = box.x + box.width * 0.65,
        y = box.y + box.height / 2;
      await begin(x, y);
      await move(x - distance / 2, y + 1);
      await move(x - distance, y + 2);
      await end();
    };
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        () =>
          document.querySelector('.vehicle-photo .photo-rail-track')?.dataset.moving === 'false',
      );
      const stage = page.locator('.vehicle-photo-stage');
      const first = await selected();
      await drag(stage, 30);
      await page.waitForTimeout(600);
      assert.notEqual(await selected(), first, 'short real-photo drag must commit, not snap back');
      await drag(stage, -30);
      await page.waitForTimeout(600);
      assert.equal(await selected(), first);
      assert.equal(await page.locator('dialog.gallery-dialog').isVisible(), false);
      await activate(page.locator('.photo-expand'));
      const dialog = page.locator('dialog.gallery-dialog');
      await dialog.waitFor({ state: 'visible' });
      await page.waitForTimeout(450);
      await drag(dialog.locator('.viewer-stage'), 30);
      await page.waitForTimeout(600);
      assert.notEqual(await selected(), first, 'short fullscreen drag must commit');
      await drag(dialog.locator('.viewer-stage'), -30);
      await page.waitForTimeout(600);
      assert.equal(await selected(), first);
      const box = await dialog.locator('.viewer-stage').boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      const opacity = () =>
        dialog
          .locator('.viewer-stage > .photo-rail')
          .evaluate((el) => Number(getComputedStyle(el).opacity));
      await begin(x, y);
      await move(x, y + 40);
      const intermediate = await opacity();
      assert.ok(intermediate < 1 && intermediate > 0.45);
      await move(x, y + 190);
      assert.ok(Math.abs((await opacity()) - 0.45) < 0.01);
      await page.waitForTimeout(250);
      assert.equal(await dialog.isVisible(), true, 'holding below must not dismiss before release');
      await move(x, y + 40);
      assert.ok((await opacity()) > 0.6);
      await move(x, y);
      assert.ok(Math.abs((await opacity()) - 1) < 0.01);
      await end();
      assert.equal(await dialog.isVisible(), true, 'returning before release cancels dismissal');
      await begin(x, y);
      await move(x, y + 190);
      await page.evaluate(() => {
        window.dismissFrames = [];
        const sample = () => {
          const dialog = document.querySelector('dialog.gallery-dialog');
          if (!dialog.open) return;
          const floating = dialog.querySelector('[data-opening-photo]');
          if (dialog.hasAttribute('data-closing') && floating)
            window.dismissFrames.push(Number(getComputedStyle(floating).opacity));
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await end();
      await dialog.waitFor({ state: 'hidden' });
      const exit = await page.evaluate(() => window.dismissFrames);
      assert.ok(
        exit.length > 0 && exit.every((opacity) => opacity <= 0.46),
        'dismissal must not flash fully opaque',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await activate(page.locator('.photo-expand'));
      await dialog.waitFor({ state: 'visible' });
      const reducedBox = await dialog.locator('.viewer-stage').boundingBox();
      const rx = reducedBox.x + reducedBox.width / 2,
        ry = reducedBox.y + reducedBox.height / 2;
      await begin(rx, ry);
      await move(rx, ry + 40);
      assert.ok((await opacity()) < 1);
      await move(rx, ry);
      assert.equal(await opacity(), 1);
      await end();
      await activate(dialog.locator('.dialog-close'));
      await dialog.waitFor({ state: 'hidden' });
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      const carousel = page.locator('.carousel'),
        viewport = carousel.locator('.viewport');
      await carousel.scrollIntoViewIfNeeded();
      assert.equal(
        await carousel.getAttribute('class').then((v) => v.includes('looping')),
        true,
        'choose a vehicle with enough related cards',
      );
      const visibleCard = async () => {
        const index = await carousel.locator('.slide:not(.ghost)').evaluateAll((slides) => {
          const frame = document.querySelector('.carousel .viewport').getBoundingClientRect();
          return slides.findIndex((slide) => {
            const b = slide.getBoundingClientRect();
            return b.left >= frame.left && b.right <= frame.right;
          });
        });
        assert.ok(index >= 0);
        return carousel.locator('.slide:not(.ghost)').nth(index);
      };
      await carousel.locator('.track').evaluate((track) => {
        window.cardNodes = [...track.querySelectorAll('.card-arrow, .card-compare')];
        window.cardPaintFailures = [];
        const sample = () => {
          if (!track.isConnected) return;
          const frame = track.parentElement.getBoundingClientRect();
          for (const node of window.cardNodes) {
            const b = node.getBoundingClientRect(),
              css = getComputedStyle(node);
            if (
              !node.isConnected ||
              (b.right > frame.left &&
                b.left < frame.right &&
                (css.visibility !== 'visible' ||
                  css.display === 'none' ||
                  Number(css.opacity) < 0.99))
            )
              window.cardPaintFailures.push('hidden or remounted control');
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      for (const selector of [
        '.card-compare button',
        '.card-favorite button',
        '.card-image',
        '.card-info h3',
      ]) {
        const card = await visibleCard(),
          target = card.locator(selector);
        const before = await carousel
          .locator('.position-indicators button[aria-current=true]')
          .getAttribute('aria-label');
        const controls = await carousel
          .locator('.slide:not(.ghost) button[aria-pressed]')
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-pressed')));
        const targetBox = await target.boundingBox(),
          cardBox = await card.boundingBox();
        const sx = targetBox.x + targetBox.width / 2,
          sy = targetBox.y + targetBox.height / 2;
        await begin(sx, sy);
        await move(sx - cardBox.width * 0.35, sy + 1);
        await move(sx - cardBox.width * 0.7, sy + 2);
        await end();
        await page.waitForTimeout(750);
        assert.notEqual(
          await carousel
            .locator('.position-indicators button[aria-current=true]')
            .getAttribute('aria-label'),
          before,
          selector + ' must start a drag',
        );
        assert.deepEqual(
          await carousel
            .locator('.slide:not(.ghost) button[aria-pressed]')
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-pressed'))),
          controls,
          'drag must not toggle buttons',
        );
        assert.equal(page.url(), url.href, 'drag must not follow card link');
      }
      for (const selector of ['.card-compare button', '.card-favorite button']) {
        const button = (await visibleCard()).locator(selector),
          before = await button.getAttribute('aria-pressed');
        await activate(button);
        await page
          .waitForFunction(
            ({ element, before }) => element.getAttribute('aria-pressed') !== before,
            { element: await button.elementHandle(), before },
            { timeout: 3000 },
          )
          .catch(async (error) => {
            console.log(
              JSON.stringify({
                width,
                selector,
                moving: await carousel.getAttribute('data-moving'),
              }),
            );
            throw error;
          });
        assert.notEqual(
          await button.getAttribute('aria-pressed'),
          before,
          'tap without drag keeps button action',
        );
      }
      assert.deepEqual(await page.evaluate(() => window.cardPaintFailures), []);
      const keyboard = (await visibleCard()).locator('.card-favorite button');
      const beforeKeyboard = await keyboard.getAttribute('aria-pressed');
      await keyboard.focus();
      await page.keyboard.press('Space');
      assert.notEqual(await keyboard.getAttribute('aria-pressed'), beforeKeyboard);
      assert.equal(
        await keyboard.evaluate((button) => getComputedStyle(button).outlineStyle),
        'solid',
      );
      // Pause JS time, not painting, to inspect actual pixels throughout settle.
      // This catches disappearing composited controls even when DOM/CSS stay visible.
      await page.clock.install();
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      const paint = cdp ?? (await context.newCDPSession(page));
      const card = await visibleCard(),
        image = await card.locator('.card-image').boundingBox();
      const sx = image.x + image.width * 0.65,
        sy = image.y + image.height / 2;
      await begin(sx, sy);
      await move(sx - image.width * 0.35, sy);
      await move(sx - image.width * 0.7, sy);
      await end();
      const pixelSamples = [];
      for (let phase = 0; phase < 4; phase++) {
        if (phase) await page.clock.runFor(80);
        assert.equal(await carousel.getAttribute('data-moving'), 'true');
        assert.equal(
          await carousel.locator('.track').evaluate((track) => track.getAnimations().length),
          0,
          'settle must not switch to parent WAAPI',
        );
        // Keep photo hover/other CSS transitions identical in the visible and
        // hidden reference; only the JS-driven track advances between samples.
        await page.evaluate(() =>
          document.getAnimations().forEach((animation) => animation.pause()),
        );
        const regions = await carousel.evaluate((carousel) => {
          const frame = carousel.querySelector('.viewport').getBoundingClientRect();
          window.pixelControls = ['.card-arrow', '.card-compare'].map((selector) =>
            [...carousel.querySelectorAll(selector)].find((node) => {
              const r = node.getBoundingClientRect();
              return (
                r.left >= frame.left &&
                r.right <= frame.right &&
                r.top >= 0 &&
                r.bottom <= innerHeight
              );
            }),
          );
          if (window.pixelControls.some((node) => !node))
            throw new Error('No fully visible control region during settle');
          return window.pixelControls.map((node) => {
            const r = node.getBoundingClientRect();
            return {
              x: Math.ceil(r.x),
              y: Math.ceil(r.y),
              width: Math.floor(r.width) - 1,
              height: Math.floor(r.height) - 1,
            };
          });
        });
        const visible = Buffer.from(
          (await paint.send('Page.captureScreenshot', { format: 'png' })).data,
          'base64',
        );
        await page.evaluate(() => {
          for (const node of window.pixelControls)
            node.style.setProperty('visibility', 'hidden', 'important');
        });
        const hidden = Buffer.from(
          (await paint.send('Page.captureScreenshot', { format: 'png' })).data,
          'base64',
        );
        await page.evaluate(() => {
          for (const node of window.pixelControls) node.style.removeProperty('visibility');
        });
        const differences = [];
        for (const region of regions) {
          const a = await sharp(visible)
            .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
            .removeAlpha()
            .raw()
            .toBuffer();
          const b = await sharp(hidden)
            .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
            .removeAlpha()
            .raw()
            .toBuffer();
          let changed = 0;
          for (let i = 0; i < a.length; i += 3)
            if (
              Math.abs(a[i] - b[i]) +
                Math.abs(a[i + 1] - b[i + 1]) +
                Math.abs(a[i + 2] - b[i + 2]) >
              60
            )
              changed++;
          assert.ok(changed > 40, 'control must paint distinct pixels during settle');
          differences.push(changed);
        }
        await writeFile(`${output}/settle-${width}-${phase}.png`, visible);
        pixelSamples.push({ phase, differences });
      }
      await page.clock.runFor(600);
      await page.clock.resume();
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${output}/${width}.png` });
      results.push({
        width,
        shortDrags: 'main/fullscreen both directions committed',
        fade: 'floor/hold/return passed',
        cards: 'four origins, no toggle/navigation, stable control DOM/visibility',
        errors,
        pixelSamples,
      });
      console.log(`PASS real vehicle interactions ${width}px`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
