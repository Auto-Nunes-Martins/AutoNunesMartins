import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import path from 'node:path';

export async function captureCarouselFrames(browser, origin, output) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  let releasePhoto;
  const photoGate = new Promise((resolve) => (releasePhoto = resolve));
  const secondPhoto = (url) => new URL(url).pathname.includes('hero-check-aaaaaaaaaaa1/photos/');
  try {
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (new URL(url).origin !== origin) return route.abort();
      if (secondPhoto(url)) await photoGate;
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const feature = page.getByRole('region', { name: 'Viaturas em destaque' });
    const buttons = feature.locator('.hd-progress button');
    await feature.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(feature).toHaveAttribute('data-carousel-paused', 'false', { timeout: 12000 });
    const capture = (name) => feature.screenshot({ path: path.join(output, name + '.png') });
    await capture('00-rest');

    const armCapture = (kind, target) =>
      target.evaluate((button, kind) => {
        const node = button.closest('.hd-feature');
        window.carouselCaptures ??= {};
        const observer = new MutationObserver(() => {
          if (button.getAttribute('aria-pressed') !== 'true') return;
          observer.disconnect();
          requestAnimationFrame(() => {
            const animations = node
              .getAnimations({ subtree: true })
              .filter(
                (animation) =>
                  animation.id.endsWith('-vehicle-change') ||
                  animation.animationName === 'hd-progress-pulse' ||
                  animation.effect?.target?.classList?.contains('featured-photo-outgoing'),
              );
            for (const animation of animations) animation.pause();
            window.carouselCaptures[kind] = animations;
          });
        });
        observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] });
      }, kind);
    const captureChange = async (kind) => {
      await page.waitForFunction((kind) => kind in window.carouselCaptures, kind, {
        timeout: 12000,
      });
      assert.equal(await page.evaluate((kind) => window.carouselCaptures[kind].length, kind), 4);
      for (const time of [100, 215, 350, 520, 700]) {
        await page.evaluate(
          ({ kind, time }) => {
            for (const animation of window.carouselCaptures[kind]) {
              animation.currentTime = Math.min(time, animation.effect.getComputedTiming().duration);
            }
          },
          { kind, time },
        );
        await capture(`${kind}-${time}ms`);
      }
      await page.evaluate((kind) => {
        for (const animation of window.carouselCaptures[kind]) animation.finish();
      }, kind);
      await expect(feature.locator('.featured-photo-outgoing')).toHaveCount(0);
      await capture(`${kind}-rest`);
    };

    const loading = page.waitForRequest((request) => secondPhoto(request.url()));
    await buttons.nth(1).tap();
    await loading;
    await expect(feature.locator('.featured-photo-pending')).toHaveCount(1);
    await capture('01-image-pending');
    await armCapture('02-manual', buttons.nth(1));
    await armCapture('03-auto', buttons.first());
    releasePhoto();
    await captureChange('02-manual');
    await captureChange('03-auto');
    console.log(`Carousel frames: ${output}`);
  } finally {
    releasePhoto();
    await context.close();
  }
}

function observeCarousel(feature) {
  const progress = feature.querySelector('.hd-progress');
  const buttons = [...progress.querySelectorAll('button')];
  const photo = feature.querySelector('.hd-photo-motion');
  const price = feature.querySelector('.price-amount');
  const label = feature.querySelector('.hd-feature-top .hd-eyebrow');
  const badge = label.closest('.hd-label-motion');
  const star = badge.querySelector('svg');
  const text = label.querySelector('.hd-label-text');
  const range = document.createRange();
  range.selectNodeContents(text);
  const baseline = document.createElement('i');
  baseline.style.cssText =
    'display:inline-block;width:0;height:0;padding:0;border:0;vertical-align:baseline';
  text.append(baseline);
  const canvas = document.createElement('canvas').getContext('2d');
  const style = getComputedStyle(text);
  canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = canvas.measureText('EM DESTAQUE');
  const labelPosition = () => {
    const bounds = label.getBoundingClientRect();
    const textBox = range.getBoundingClientRect();
    const textBaseline = baseline.getBoundingClientRect().top;
    const scale = badge.getBoundingClientRect().height / badge.offsetHeight;
    const starBox = star.getBoundingClientRect();
    const starCenter = (starBox.top + starBox.bottom) / 2;
    return {
      x: bounds.left + scrollX,
      y: bounds.top + scrollY,
      viewportY: bounds.top,
      height: feature.offsetHeight,
      identityHeight: feature.querySelector('.hd-caption:not(.hd-caption-sizing) .hd-identity')
        .offsetHeight,
      starY: starCenter,
      starTop: starBox.top,
      starHeight: starBox.height,
      textTop: textBox.top,
      textHeight: textBox.height,
      baseline: textBaseline,
      opticalOffset:
        textBaseline +
        ((metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) * scale) / 2 -
        starCenter,
    };
  };
  const track = (element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: bounds.left + bounds.width / 2 - progress.getBoundingClientRect().left,
      y: (bounds.top + bounds.bottom) / 2,
      width: bounds.width,
      height: bounds.height,
      layoutHeight: element.offsetHeight,
      color: style.backgroundColor,
      radius: style.borderRadius,
    };
  };
  let active = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
  const tracks = buttons.map((button) => button.querySelector('span'));
  const restingTracks = tracks.map(track);
  const initialPriceWidth = price.parentElement.getBoundingClientRect().width;
  text.style.setProperty('text-box', 'normal');
  window.carouselLabelFallbackOffset = labelPosition().opticalOffset;
  text.style.removeProperty('text-box');
  let restingLabel = labelPosition();
  window.carouselChanges = [];
  new MutationObserver(() => {
    const next = buttons.find((button) => button.getAttribute('aria-pressed') === 'true');
    if (!next || next === active) return;
    const previousTrack = active.querySelector('span');
    const nextTrack = next.querySelector('span');
    const from = track(previousTrack);
    const to = track(nextTrack);
    active = next;
    const start = performance.now();
    const frames = [];
    const beforeLabel = restingLabel;
    function sample(now) {
      const transform = getComputedStyle(photo).transform;
      const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
      const outgoing = feature.querySelector('.featured-photo-outgoing');
      frames.push({
        time: now - start,
        label: labelPosition(),
        from: track(previousTrack),
        to: track(nextTrack),
        barTime: nextTrack.getAnimations()[0]?.currentTime ?? null,
        priceSlotWidth: price.parentElement.getBoundingClientRect().width,
        photo: matrix.a,
        translation: matrix.e,
        price: new DOMMatrixReadOnly(
          getComputedStyle(price).transform === 'none'
            ? undefined
            : getComputedStyle(price).transform,
        ).a,
        priceColor: getComputedStyle(price).color,
        outgoing: outgoing ? Number(getComputedStyle(outgoing).opacity) : null,
      });
      if (now - start < 900) requestAnimationFrame(sample);
      else {
        restingLabel = frames.at(-1).label;
        window.carouselChanges.push({
          from,
          to,
          restingTracks,
          frames,
          initialPriceWidth,
          beforeLabel,
        });
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

function checkCarouselMotion({ from, to, restingTracks, frames, initialPriceWidth }, reduced) {
  const last = frames.at(-1);
  const resting = restingTracks[0];
  assert.ok(Math.abs(to.x - from.x) > 50);
  assert.ok(Math.abs(from.width - to.width) < 0.1);
  for (const frame of frames) {
    for (const [bar, x] of [
      [frame.from, from.x],
      [frame.to, to.x],
    ]) {
      assert.ok(
        Math.abs(bar.x - x) < 0.1 && Math.abs(bar.y - resting.y) < 0.1,
        'bar centre stays fixed',
      );
      assert.ok(Math.abs(bar.width - resting.width) < 0.1, 'bar width stays fixed');
      assert.equal(bar.layoutHeight, 2);
    }
    assert.equal(frame.to.color, 'rgb(255, 255, 255)', 'new bar turns white immediately');
    assert.notEqual(frame.from.color, frame.to.color, 'old bar turns grey immediately');
    assert.ok(Math.abs(frame.from.height - resting.height) < 0.1, 'old bar stays flat');
    assert.equal(frame.from.radius, '0px');
    assert.ok(parseFloat(frame.to.radius) <= 0.56, 'rounded corners stay subtle');
  }
  assert.ok(Math.abs(last.to.height - resting.height) < 0.1);
  assert.equal(last.to.radius, '0px');
  assert.ok(frames.every((frame) => Math.abs(frame.priceSlotWidth - initialPriceWidth) < 1));
  assert.ok(
    frames.every((frame) => Math.abs(frame.translation) < 0.01),
    'no lateral translation',
  );
  assert.ok(Math.abs(last.photo - 1) < 0.001 && Math.abs(last.price - 1) < 0.001);
  assert.equal(last.outgoing, null);
  assert.equal(last.priceColor, 'rgb(250, 250, 250)');
  if (reduced) {
    assert.ok(
      frames.every(
        (frame) => Math.abs(frame.to.height - resting.height) < 0.1 && frame.to.radius === '0px',
      ),
    );
    assert.ok(
      frames.every((frame) => frame.photo === 1 && frame.price === 1 && frame.outgoing === null),
    );
    return;
  }
  const barPeak = frames.reduce((peak, frame) => (frame.to.height > peak.to.height ? frame : peak));
  assert.ok(barPeak.to.height > resting.height * 1.75 && barPeak.to.height < resting.height * 1.92);
  assert.ok(parseFloat(barPeak.to.radius) > 0.45);
  assert.ok(frames.filter((frame) => frame.outgoing > 0.1 && frame.outgoing < 0.9).length >= 3);
  const photoPeak = Math.max(...frames.map((frame) => frame.photo));
  const pricePeak = frames.reduce((peak, frame) => (frame.price > peak.price ? frame : peak));
  assert.ok(photoPeak >= 1.015 && photoPeak <= 1.019, `subtle photo peak (${photoPeak})`);
  assert.ok(
    pricePeak.price >= 1.108 && pricePeak.price <= 1.121,
    `stronger price peak (${pricePeak.price})`,
  );
  assert.ok(
    barPeak.barTime > 155 && barPeak.barTime < 280,
    `the bar builds over the first part of the change (${barPeak.barTime} ms)`,
  );
  assert.ok(pricePeak.time > barPeak.time + 75, 'the price peaks after the bar');
  assert.ok(
    frames.some((frame) => frame.time > 535 && frame.to.radius === '0px' && frame.price > 1.025),
    'the price lingers after the bar settles',
  );
  assert.ok(frames.some((frame) => frame.price > 1.1 && frame.priceColor !== last.priceColor));
}

export async function publicMotionCheck(browser, origin, slug) {
  for (const [width, reducedMotion] of [
    [320, 'no-preference'],
    [375, 'no-preference'],
    [390, 'no-preference'],
    [430, 'no-preference'],
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
      let releasePhoto;
      const delayPhoto = width === 390 && !reduced;
      const photoGate = new Promise((resolve) => (releasePhoto = resolve));
      const secondPhoto = (url) =>
        new URL(url).pathname.includes('hero-check-aaaaaaaaaaa1/photos/');
      await context.route('**/*', async (route) => {
        const url = route.request().url();
        if (new URL(url).origin !== origin) return route.abort();
        if (delayPhoto && secondPhoto(url)) await photoGate;
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      const feature = page.getByRole('region', { name: 'Viaturas em destaque' });
      await feature.evaluate((node) =>
        node.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await expect(feature).toHaveAttribute('data-carousel-paused', 'false', { timeout: 12000 });
      await expect(feature.locator('.hd-photo-note')).toHaveCount(0);
      const positions = feature.locator('.hd-progress button');
      const initiallyActive =
        (await positions.first().getAttribute('aria-pressed')) === 'true' ? 0 : 1;
      const next = positions.nth(1 - initiallyActive);
      await feature.evaluate(observeCarousel);
      if (mobile) {
        const fallback = await page.evaluate(() => window.carouselLabelFallbackOffset);
        assert.ok(Math.abs(fallback) < 1, `centred without text-box trimming (${fallback}px)`);
      }
      const loading = delayPhoto
        ? page.waitForRequest((request) => secondPhoto(request.url()))
        : null;
      if (mobile) await next.tap();
      else {
        await next.click();
        await page.mouse.move(0, 0);
      }
      if (loading) {
        try {
          await loading;
          await expect(positions.nth(initiallyActive)).toHaveAttribute('aria-pressed', 'true');
          await expect(feature.locator('.featured-photo-pending')).toHaveCount(1);
          assert.equal(
            await feature.evaluate((node) =>
              node
                .getAnimations({ subtree: true })
                .some(
                  (animation) =>
                    animation.id.endsWith('-vehicle-change') ||
                    animation.animationName === 'hd-progress-pulse',
                ),
            ),
            false,
          );
          assert.deepEqual(await page.evaluate(() => window.carouselChanges), []);
        } finally {
          releasePhoto();
        }
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
      await expect(feature.locator('.hd-photo-note')).toHaveCount(0);
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
        const drift = (key) =>
          Math.max(
            ...motion.frames.map(({ label }) => Math.abs(label[key] - motion.beforeLabel[key])),
          );
        const optical = motion.frames.at(-1).label.opticalOffset;
        const alignment = mobile
          ? `; star Δy=${drift('starTop').toFixed(2)}px; text Δy=${drift('textTop').toFixed(2)}px, baseline Δy=${drift('baseline').toFixed(2)}px, optical offset≈${optical.toFixed(2)}px`
          : '';
        console.log(
          `${browser.browserType().name()} ${width}px ${['manual', 'autoplay', 'swipe'][index]} ${reducedMotion}: label Δx=${dx.toFixed(2)}px Δy=${dy.toFixed(2)}px viewport Δy=${viewportDy.toFixed(2)}px${alignment}; card ${motion.beforeLabel.height}→${endHeight}px`,
        );
        if (mobile) {
          assert.ok(dx < 0.1 && dy < 0.1 && viewportDy < 0.1, 'the mobile header stays anchored');
          for (const key of ['starTop', 'starHeight', 'textTop', 'textHeight', 'baseline']) {
            assert.ok(drift(key) < 0.1, `${key} stays anchored`);
          }
          assert.ok(Math.abs(optical) < 1, 'star and text are optically centred');
          assert.ok(
            Math.abs(
              motion.frames.at(-1).label.identityHeight - motion.beforeLabel.identityHeight,
            ) > 10,
            'fixture uses different caption heights',
          );
          assert.equal(
            endHeight,
            motion.beforeLabel.height,
            'card reserves space for its longest caption',
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
