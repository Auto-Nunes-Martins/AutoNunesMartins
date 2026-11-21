import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

async function checkLightGeometry(heading) {
  await expect
    .poll(() => heading.locator('em').evaluate((n) => n.style.getPropertyValue('--tip-x')))
    .not.toBe('');
  const error = await heading.evaluate((h) => {
    const line = h.querySelector('.line-window').getBoundingClientRect();
    const smooth = (x) => {
      const p = Math.min(1, Math.max(0, x));
      return p * p * (3 - 2 * p);
    };
    let journey = (innerHeight * 0.92 - h.getBoundingClientRect().top) / (innerHeight * 0.84);
    if (h.closest('#campanhas'))
      journey = Math.min(journey, Math.max(0, scrollY) / (innerHeight * 0.84));
    const light = smooth(journey - 25 / (innerHeight * 0.84));
    const x = line.left + line.width * light * 2;
    const y = line.bottom + line.height * 0.08;
    return [...h.querySelectorAll('.read-a, .read-b, em')].map((n) => {
      const r = n.getBoundingClientRect();
      const error = Math.max(
        Math.abs(
          parseFloat(n.style.getPropertyValue('--tip-x')) -
            ((n.tagName === 'EM' ? Math.min(x, line.right) : x) - r.left),
        ),
        Math.abs(parseFloat(n.style.getPropertyValue('--tip-y')) - (y - r.top)),
      );
      return {
        error,
        class: n.className,
        tip: n.style.getPropertyValue('--tip-x'),
        left: r.left,
        top: r.top,
        width: r.width,
        headingWidth: h.getBoundingClientRect().width,
        lineLeft: line.left,
        journey,
      };
    });
  });
  assert.ok(
    error.every((n) => n.error < 0.75),
    `Text light left its text: ${JSON.stringify(error)}`,
  );
}

// Synthetic local fixture and local captures only. No personal browser or CRM writes.
export async function mobileCampaignEffects(browser, origin) {
  const output = path.resolve(`../../.cache/underline-review-${Date.now()}`);
  await mkdir(output, { recursive: true });
  let approvedGlow;
  for (const width of [390, 700, 701, 1440]) {
    const mobile = width <= 700;
    const page = await browser.newPage({
      viewport: { width, height: 950 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    page.setDefaultTimeout(15000);
    try {
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      await page.goto(origin);
      await page.locator('.design.motion-on').waitFor();
      const photo = page.locator('.hd-photo');
      await expect(photo).toBeVisible();
      // SSR/motion marker precedes hydration; wait for the swipe action itself.
      await page.waitForFunction(
        () => !!document.querySelector('.hd-photo-stage')?.style.touchAction,
      );
      const hiddenDecor = async () => {
        await expect(page.locator('.hd-feature-light')).toBeHidden();
        assert.equal(
          await page
            .locator('.hd-caption-stack')
            .evaluate((n) => getComputedStyle(n, '::before').display),
          'none',
        );
      };
      if (mobile) {
        await hiddenDecor();
        const before = await photo.getAttribute('href');
        // The action uses Touch Events on mobile (including WebKit), not pointer events.
        const rect = await photo.boundingBox();
        const touch = async (type, x) =>
          photo.evaluate(
            (node, { type, x, y }) => {
              const data = { identifier: 1, target: node, clientX: x, clientY: y };
              try {
                const point = new Touch(data);
                node.dispatchEvent(
                  new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [point],
                    changedTouches: [point],
                  }),
                );
              } catch {
                // Windows WebKit has Touch Events but no constructible Touch object.
                const event = new Event(type, { bubbles: true, cancelable: true });
                Object.defineProperties(event, {
                  touches: { value: type === 'touchend' ? [] : [data] },
                  changedTouches: { value: [data] },
                });
                node.dispatchEvent(event);
              }
            },
            { type, x, y: rect.y + rect.height / 2 },
          );
        await touch('touchstart', rect.x + rect.width * 0.8);
        await page.waitForTimeout(650);
        await hiddenDecor();
        await touch('touchmove', rect.x + rect.width * 0.2);
        await touch('touchend', rect.x + rect.width * 0.2);
        await expect(photo).not.toHaveAttribute('href', before);
        await hiddenDecor();
        await photo.focus();
        await hiddenDecor();
      } else {
        // The approved desktop idle float intentionally never becomes stationary.
        await photo.hover({ force: true });
        await expect(page.locator('.hd-backlight')).toHaveCSS('opacity', '0.35');
        assert.notEqual(
          await page.locator('.hd-feature-light').evaluate((n) => getComputedStyle(n).display),
          'none',
        );
      }
      const campaign = page.locator('#campanhas');
      await campaign.scrollIntoViewIfNeeded();
      const ticker = campaign.locator('.ticker-group').first();
      assert.equal(await ticker.locator('.lucide-arrow-up-right').count(), 8);
      assert.equal(await ticker.locator('svg.ticker-dot').count(), 16);
      assert.ok(!(await ticker.textContent()).includes('✳'));
      assert.equal(
        await ticker.locator('svg.ticker-dot').first().getAttribute('viewBox'),
        '0 0 16 16',
      );
      const top = await campaign
        .locator('h2')
        .evaluate((n) => n.getBoundingClientRect().top + scrollY);
      const poses = [];
      for (const fraction of [0.85, 0.65, 0.45, 0.25, 0.05, -0.1]) {
        await page.evaluate(
          ({ top, fraction }) =>
            scrollTo({ top: Math.max(0, top - innerHeight * fraction), behavior: 'instant' }),
          { top, fraction },
        );
        await page.waitForTimeout(140);
        poses.push(
          await campaign
            .locator('h2')
            .evaluate((n) => Number(n.style.getPropertyValue('--line-progress'))),
        );
        await checkLightGeometry(campaign.locator('h2'));
        if (fraction === 0.45) {
          const glow = await campaign
            .locator('.line-window')
            .evaluate((n) => getComputedStyle(n).filter);
          assert.notEqual(glow, 'none');
          approvedGlow ??= glow;
          assert.equal(glow, approvedGlow, 'Mobile and desktop must use the same glow');
          const r = await campaign.locator('h2').boundingBox();
          await page.screenshot({
            path: path.join(output, `campaign-${width}.png`),
            clip: {
              x: Math.max(0, r.x - 25),
              y: r.y - 25,
              width: Math.min(width - Math.max(0, r.x - 25), r.width + 50),
              height: r.height + 50,
            },
          });
        }
      }
      assert.ok(poses[0] < poses[2] && poses[2] < poses[4]);
      if (mobile) {
        await expect(campaign.locator('.line-window')).toHaveCSS('opacity', '0');
        await expect(campaign.locator('.line-window')).not.toHaveCSS('filter', 'none');
        await expect(campaign.locator('.travelling-line')).toHaveCSS('transition-duration', '0s');
        await expect(campaign.locator('.travelling-line')).toHaveCSS('box-shadow', 'none');
        await expect(campaign.locator('h2')).toHaveCSS('--accent-light', '0');
        await expect(campaign.locator('em')).toHaveCSS('text-decoration-line', 'none');
        assert.equal(
          await campaign.locator('em').evaluate((n) => getComputedStyle(n, '::after').content),
          'none',
        );
      }
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(180);
      if (mobile) await expect(campaign.locator('.line-window')).toHaveCSS('opacity', '0');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(campaign.locator('.line-window')).toBeHidden();
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      for (const route of ['/', '/quem-somos']) {
        if (route !== '/') {
          await page.goto(origin + route);
          await page.locator('.design.motion-on').waitFor();
        }
        const heading = page.locator('.site-perspective h2').first();
        await heading.scrollIntoViewIfNeeded();
        for (const fraction of [0.65, 0.45, 0.25]) {
          await heading.evaluate(
            (h, f) =>
              scrollTo({
                top: h.getBoundingClientRect().top + scrollY - innerHeight * f,
                behavior: 'instant',
              }),
            fraction,
          );
          await page.waitForTimeout(160);
          await checkLightGeometry(heading);
          assert.equal(
            await heading.locator('.line-window').evaluate((n) => getComputedStyle(n).filter),
            approvedGlow,
          );
        }
        if (route === '/') {
          const discover = page.locator('a.discover');
          await discover.scrollIntoViewIfNeeded();
          if (mobile) {
            await discover.locator('strong').evaluate((h) =>
              scrollTo({
                top: h.getBoundingClientRect().top + scrollY - innerHeight * 0.5,
                behavior: 'instant',
              }),
            );
          } else await discover.hover({ force: true });
          await page.waitForTimeout(400);
          assert.equal(
            await discover.locator('.title-line').evaluate((n) => getComputedStyle(n).filter),
            approvedGlow,
          );
          const transform = await discover
            .locator('.title-line i')
            .evaluate((n) => getComputedStyle(n).transform);
          assert.notEqual(transform, 'none');
          await expect(discover).toHaveAttribute('href', '/viaturas');
        }
      }
      console.log(
        `Effects: ${width}px swipe/hover, ticker SVG, scroll endpoints and reduced motion passed.`,
      );
    } finally {
      await page.close();
    }
  }
  console.log(`Underline screenshots: ${output}`);
}
