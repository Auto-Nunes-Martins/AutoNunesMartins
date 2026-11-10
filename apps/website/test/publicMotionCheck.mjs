import assert from 'node:assert/strict';
import { expect } from '@playwright/test';

function observeCarousel(feature) {
  const progress = feature.querySelector('.hd-progress');
  const buttons = [...progress.querySelectorAll('button')];
  const photo = feature.querySelector('.hd-photo-motion');
  const price = feature.querySelector('.price-amount');
  const label = feature.querySelector('.hd-feature-top .hd-eyebrow');
  const labelPosition = () => {
    const bounds = label.getBoundingClientRect();
    return {
      x: bounds.left + scrollX,
      y: bounds.top + scrollY,
      viewportY: bounds.top,
      height: feature.offsetHeight,
    };
  };
  const center = (element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left + bounds.width / 2 - progress.getBoundingClientRect().left;
  };
  let active = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
  const initialPriceWidth = price.parentElement.getBoundingClientRect().width;
  let restingLabel = labelPosition();
  window.carouselChanges = [];
  new MutationObserver(() => {
    const next = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
    if (!next || next === active) return;
    const previousTrack = active.querySelector('span');
    const nextTrack = next.querySelector('span');
    const from = center(previousTrack);
    const to = center(nextTrack);
    active = next;
    const start = performance.now();
    const frames = [];
    const beforeLabel = restingLabel;
    function sample(now) {
      const transform = getComputedStyle(photo).transform;
      const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
      const outgoing = feature.querySelector('.featured-photo-outgoing');
      frames.push({
        label: labelPosition(),
        from: center(previousTrack),
        to: center(nextTrack),
        previous: Number(getComputedStyle(previousTrack, '::after').opacity),
        next: Number(getComputedStyle(nextTrack, '::after').opacity),
        priceSlotWidth: price.parentElement.getBoundingClientRect().width,
        photo: matrix.a,
        translation: matrix.e,
        price:
          parseFloat(getComputedStyle(price).fontSize) /
          parseFloat(getComputedStyle(price.parentElement).fontSize),
        outgoing: outgoing ? Number(getComputedStyle(outgoing).opacity) : null,
      });
      if (now - start < 700) requestAnimationFrame(sample);
      else {
        restingLabel = frames.at(-1).label;
        window.carouselChanges.push({ from, to, frames, initialPriceWidth, beforeLabel });
      }
    }
    requestAnimationFrame(sample);
  }).observe(progress, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
}

function swipe(photo) {
  const bounds = photo.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  for (const [type, clientX] of [
    ['touchstart', x],
    ['touchmove', x - 45],
    ['touchend', x - 90],
  ]) {
    const point = { identifier: 1, clientX, clientY: y };
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      touches: { value: type === 'touchend' ? [] : [point] },
      changedTouches: { value: [point] },
    });
    photo.dispatchEvent(event);
  }
}

function checkCarouselMotion({ from, to, frames, initialPriceWidth }, reduced) {
  const last = frames.at(-1);
  assert.ok(Math.abs(to - from) > 50);
  assert.ok(
    frames.every((frame) => Math.abs(frame.from - from) < 1 && Math.abs(frame.to - to) < 1),
  );
  assert.equal(last.previous, 0);
  assert.equal(last.next, 1);
  assert.ok(frames.every((frame) => Math.abs(frame.priceSlotWidth - initialPriceWidth) < 1));
  assert.ok(
    frames.every((frame) => Math.abs(frame.translation) < 0.01),
    'no lateral translation',
  );
  assert.ok(Math.abs(last.photo - 1) < 0.001 && Math.abs(last.price - 1) < 0.001);
  assert.equal(last.outgoing, null);
  if (reduced) {
    assert.ok(frames.every((frame) => frame.previous === 0 && frame.next === 1));
    assert.ok(
      frames.every((frame) => frame.photo === 1 && frame.price === 1 && frame.outgoing === null),
    );
    return;
  }
  assert.ok(
    frames.filter(
      (frame) =>
        frame.next > 0.08 && frame.next < 0.92 && frame.previous > 0.08 && frame.previous < 0.92,
    ).length >= 3,
  );
  assert.ok(frames.filter((frame) => frame.outgoing > 0.1 && frame.outgoing < 0.9).length >= 3);
  const photoPeak = Math.max(...frames.map((frame) => frame.photo));
  const pricePeak = Math.max(...frames.map((frame) => frame.price));
  assert.ok(photoPeak >= 1.015 && photoPeak <= 1.019, `subtle photo peak (${photoPeak})`);
  assert.ok(pricePeak >= 1.04 && pricePeak <= 1.046, `stronger price peak (${pricePeak})`);
}

export async function publicMotionCheck(browser, origin, slug) {
  for (const [width, reducedMotion] of [
    [320, 'no-preference'],
    [390, 'no-preference'],
    [390, 'reduce'],
    [1440, 'reduce'],
  ]) {
    const mobile = width <= 700;
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion,
    });
    const reduced = reducedMotion === 'reduce';
    try {
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      const page = await context.newPage();
      await page.goto(origin);
      const feature = page.getByRole('region', { name: 'Viaturas em destaque' });
      await feature.evaluate((node) =>
        node.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await expect(feature).toHaveAttribute('data-carousel-paused', 'false', { timeout: 12000 });
      const positions = feature.locator('.hd-progress button');
      const initiallyActive =
        (await positions.first().getAttribute('aria-pressed')) === 'true' ? 0 : 1;
      const next = positions.nth(1 - initiallyActive);
      await feature.evaluate(observeCarousel);
      if (mobile) await next.tap();
      else {
        await next.click();
        await page.mouse.move(0, 0);
      }
      await expect(next).toHaveAttribute('aria-pressed', 'true');
      await expect(feature.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      await expect(positions.nth(initiallyActive)).toHaveAttribute('aria-pressed', 'true', {
        timeout: 10000,
      });
      await expect(feature.getByRole('status')).toHaveAttribute('aria-live', 'off');
      await expect.poll(() => page.evaluate(() => window.carouselChanges.length)).toBe(2);
      if (mobile) {
        await feature.locator('.hd-photo').evaluate(swipe);
        await expect(next).toHaveAttribute('aria-pressed', 'true');
        await expect(feature.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      }

      await expect
        .poll(() => page.evaluate(() => window.carouselChanges.length))
        .toBe(mobile ? 3 : 2);
      const changes = await page.evaluate(() => window.carouselChanges);
      for (const [index, motion] of changes.entries()) {
        checkCarouselMotion(motion, reduced);
        const dx = Math.max(
          ...motion.frames.map(({ label }) => Math.abs(label.x - motion.beforeLabel.x)),
        );
        const dy = Math.max(
          ...motion.frames.map(({ label }) => Math.abs(label.y - motion.beforeLabel.y)),
        );
        const viewportDy = Math.max(
          ...motion.frames.map(({ label }) =>
            Math.abs(label.viewportY - motion.beforeLabel.viewportY),
          ),
        );
        const endHeight = motion.frames.at(-1).label.height;
        console.log(
          `${browser.browserType().name()} ${width}px ${['manual', 'autoplay', 'swipe'][index]} ${reducedMotion}: label Δx=${dx.toFixed(2)}px Δy=${dy.toFixed(2)}px viewport Δy=${viewportDy.toFixed(2)}px; card ${motion.beforeLabel.height}→${endHeight}px`,
        );
        if (mobile) {
          assert.ok(dx < 0.1 && dy < 0.1 && viewportDy < 0.1, 'the mobile header stays anchored');
          assert.ok(
            Math.abs(endHeight - motion.beforeLabel.height) > 10,
            'fixture changes card height',
          );
        }
      }

      if (width === 390 && !reduced) {
        const detail = feature.locator(`.hd-identity a[href="/viaturas/${slug}"]`);
        await positions.first().tap();
        await expect(detail).toBeVisible();
        await page.evaluate(() => {
          window.publicBackPaths = [];
          window.addEventListener('popstate', () => window.publicBackPaths.push(location.pathname));
        });
        await detail.tap();
        await expect(page).toHaveURL(origin + '/viaturas/' + slug);
      } else {
        await page.goto(origin + '/viaturas/' + slug);
      }
      const description = page.locator('.description-window');
      const toggle = page.locator('.description-toggle');
      const lastLink = description.getByRole('link', { name: 'Ver ficha técnica' });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(lastLink).toHaveAttribute('tabindex', '-1');
      const brand = page.locator('.detail-facts .spec-brand-tint');
      const otherIcon = page.locator('.detail-facts .vehicle-spec-glyph svg').first();
      await expect(brand).toBeVisible();
      for (const theme of ['light', 'dark']) {
        await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
        assert.equal(
          await brand.evaluate((node) => getComputedStyle(node).backgroundColor),
          await otherIcon.evaluate((node) => getComputedStyle(node).stroke),
        );
      }

      for (const expanded of [true, false]) {
        const motion = await description.evaluate(async (node) => {
          const height = () => node.getBoundingClientRect().height;
          const start = height();
          document.querySelector('.description-toggle').click();
          const animation = node
            .getAnimations()
            .find((item) => item.id === 'vehicle-description-height');
          const samples = [];
          if (animation) {
            while (animation.playState !== 'finished' && animation.playState !== 'idle') {
              await new Promise(requestAnimationFrame);
              samples.push(height());
            }
          } else {
            await new Promise(requestAnimationFrame);
          }
          return { start, samples, end: height() };
        });
        await expect(toggle).toHaveAttribute('aria-expanded', String(expanded));
        assert.ok(expanded ? motion.end > motion.start + 100 : motion.end < motion.start - 100);
        if (reduced) assert.deepEqual(motion.samples, []);
        else {
          const low = Math.min(motion.start, motion.end) + 2;
          const high = Math.max(motion.start, motion.end) - 2;
          assert.ok(motion.samples.filter((height) => height > low && height < high).length >= 3);
        }
        if (expanded) assert.equal(await lastLink.getAttribute('tabindex'), null);
        else await expect(lastLink).toHaveAttribute('tabindex', '-1');
      }
      if (width === 390 && !reduced) {
        await page.evaluate(() => history.back());
        await expect(page).toHaveURL(origin + '/');
        await expect(feature).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.publicBackPaths), ['/']);
      }
      console.log(
        `PASS ${browser.browserType().name()} public motion and brand tint, ${width}px, ${reducedMotion}`,
      );
    } finally {
      await context.close();
    }
  }
}
