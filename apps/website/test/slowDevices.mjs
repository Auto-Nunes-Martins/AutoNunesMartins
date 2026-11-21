// Production fixtures only. Synthetic CPU/network constraints are not field INP or real hardware.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';
import sharp from 'sharp';

async function verifyMotionAppearance(page, output, width) {
  // Compare both channel sets in one document: optional fonts can legitimately
  // choose different fallbacks on separate cold loads under a throttled network.
  const results = [];
  for (const selector of [
    '.site-perspective',
    '.cabin-reveal',
    '.visit-invitation',
    '.timeline',
    '.approach.frame',
    '.detail-band',
  ]) {
    const node = page.locator(selector).first();
    if (!(await node.count())) continue;
    await node.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    // Element screenshots scroll tall sections again. Capture a document clip
    // instead, keeping the viewport and sticky navigation identical for both poses.
    const capture = async () => {
      const clip = await node.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
      });
      return page.screenshot({ clip, fullPage: true, animations: 'disabled' });
    };
    const optimized = await capture();
    const original = await node.evaluate((el, selector) => {
      const attrs = [el.getAttribute('data-scene'), el.getAttribute('data-approach')];
      el.setAttribute('data-scene', '');
      if (selector !== '.detail-band') el.setAttribute('data-approach', '');
      // Refresh the scene inventory just as a component mount does.
      const marker = document.createElement('span');
      el.append(marker);
      marker.remove();
      return attrs;
    }, selector);
    await page.waitForTimeout(1500);
    const legacy = await capture();
    const a = await sharp(optimized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(legacy).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(a.info, b.info, selector + ' dimensions');
    let changed = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if ([0, 1, 2].some((c) => Math.abs(a.data[i + c] - b.data[i + c]) > 8)) changed++;
    }
    const changedRatio = changed / (a.info.width * a.info.height);
    const name = `${width}-${selector.replaceAll('.', '')}`;
    await writeFile(path.join(output, `${name}-optimized.png`), optimized);
    await writeFile(path.join(output, `${name}-legacy.png`), legacy);
    results.push({ selector, changedRatio });
    await node.evaluate((el, attrs) => {
      ['data-scene', 'data-approach'].forEach((key, i) =>
        attrs[i] === null ? el.removeAttribute(key) : el.setAttribute(key, attrs[i]),
      );
      const marker = document.createElement('span');
      el.append(marker);
      marker.remove();
    }, original);
    assert.ok(
      changedRatio < 0.001,
      `${selector}: ${(changedRatio * 100).toFixed(3)}% pixels changed`,
    );
  }
  return results;
}

export async function slowDevices(browser, origin, slug, photo) {
  const output = path.resolve(process.env.SLOW_DEVICE_OUTPUT || '../../.cache/slow-devices');
  await mkdir(output, { recursive: true });
  const results = [];
  const metrics = async (cdp) =>
    Object.fromEntries(
      (await cdp.send('Performance.getMetrics')).metrics.map(({ name, value }) => [name, value]),
    );
  for (const width of process.env.SLOW_DEVICE_WIDTHS?.split(',').map(Number) ?? [390, 1440]) {
    for (const route of process.env.SLOW_DEVICE_ROUTES?.replaceAll(':slug', slug).split(',') ?? [
      '/',
      '/viaturas',
      '/quem-somos',
      `/viaturas/${slug}`,
    ]) {
      const mobile = width === 390;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        deviceScaleFactor: mobile ? 2 : 1,
        isMobile: mobile,
        hasTouch: mobile,
      });
      await context.route('**/*', (r) => {
        const url = new URL(r.request().url());
        if (url.pathname.endsWith('/photos/access'))
          return r.fulfill({ json: { versions: ['1'.repeat(64)] } });
        if (url.pathname.includes('/photos/'))
          return r.fulfill({
            contentType: 'image/png',
            headers: { 'x-photo-version': url.searchParams.get('v') || '1'.repeat(64) },
            body: photo,
          });
        return url.origin === origin ? r.continue() : r.abort();
      });
      await context.addInitScript(() => {
        window.__slow = { cls: 0, longTasks: [], interactions: [] };
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => {
            if (!e.hadRecentInput) window.__slow.cls += e.value;
          }),
        ).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => {
            window.__slow.longTasks.push({ start: e.startTime, duration: e.duration });
          }),
        ).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver((list) =>
          list.getEntries().forEach((e) => {
            if (e.interactionId)
              window.__slow.interactions.push({ name: e.name, duration: e.duration });
          }),
        ).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 6 : 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 120,
        downloadThroughput: 1_600_000 / 8,
        uploadThroughput: 750_000 / 8,
      });
      const response = await page.goto(origin + route, {
        waitUntil: 'networkidle',
        timeout: 90000,
      });
      assert.equal(response.status(), 200);
      await page.waitForTimeout(600);
      const initial = await page.evaluate(() => ({
        ...window.__slow,
        nodes: document.querySelectorAll('*').length,
      }));
      const before = await metrics(cdp);
      // Fixed positions and cadence make the comparison reproducible; sample frame intervals too.
      const frames = await page.evaluate(async () => {
        const samples = [];
        let active = true,
          prior = performance.now();
        const frame = (now) => {
          if (!active) return;
          samples.push(now - prior);
          prior = now;
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        const height = document.documentElement.scrollHeight - innerHeight;
        for (let i = 0; i <= 80; i++) {
          scrollTo(0, (height * i) / 80);
          await new Promise((resolve) => setTimeout(resolve, 45));
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
        active = false;
        return samples;
      });
      const after = await metrics(cdp);
      const scroll = Object.fromEntries(
        [
          'LayoutCount',
          'RecalcStyleCount',
          'LayoutDuration',
          'RecalcStyleDuration',
          'ScriptDuration',
          'TaskDuration',
        ].map((key) => [key, after[key] - before[key]]),
      );
      frames.sort((a, b) => a - b);
      scroll.frameP95 = frames[Math.floor(frames.length * 0.95)];
      scroll.framesOver50 = frames.filter((n) => n > 50).length;
      if (route === '/') {
        if (mobile) {
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForTimeout(400);
          await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
          await expect(
            page.getByRole('button', { name: 'Fechar menu', exact: true }),
          ).toBeVisible();
          await page.getByRole('button', { name: 'Fechar menu', exact: true }).click();
        }
        if (process.env.SLOW_DEVICE_EXTRA_INTERACTIONS) {
          const positions = page
            .getByRole('region', { name: 'Viaturas em destaque' })
            .locator('.hd-progress button');
          const current = (await positions.first().getAttribute('aria-pressed')) === 'true' ? 0 : 1;
          await positions.nth(1 - current).click();
          await expect(positions.nth(1 - current)).toHaveAttribute('aria-pressed', 'true');
          const favorite = page
            .locator('.vehicle-card')
            .first()
            .getByRole('button', { name: /Guardar .* nos favoritos/ });
          await favorite.click();
          const saved = page
            .locator('.vehicle-card')
            .first()
            .getByRole('button', { name: /Remover .* dos favoritos/ });
          await expect(saved).toHaveAttribute('aria-pressed', 'true');
          await saved.click();
          await expect(favorite).toHaveAttribute('aria-pressed', 'false');
        }
        // Capture settled motion at the same viewport-relative positions before and after.
        for (const selector of [
          '#campanhas',
          '.site-perspective',
          '.cabin-reveal',
          '.visit-invitation',
        ]) {
          const node = page.locator(selector).first();
          if (!(await node.count())) continue;
          await node.evaluate((el) =>
            scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.15),
          );
          await page.waitForTimeout(1400);
          await node.screenshot({
            path: path.join(output, `${width}-${selector.replace(/[.#]/g, '')}.png`),
            animations: 'disabled',
          });
        }
      } else if (route === '/viaturas') {
        if (mobile) await page.locator('.filter-toggle').click();
        const sort = page.getByRole('combobox', { name: 'Ordenar por' });
        await sort.click();
        await page.getByRole('option', { name: 'Maior desconto', exact: true }).click();
        await expect(page).toHaveURL(/ordem=/);
        await expect(page.locator('.vehicle-card').first()).toBeVisible();
        await sort.focus();
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Escape');
        await expect(sort).toHaveAttribute('aria-expanded', 'false');
      } else if (route.startsWith('/viaturas/')) {
        await page.getByRole('button', { name: 'Abrir em ecrã inteiro', exact: true }).click();
        const dialog = page.locator('.gallery-dialog[open]');
        await expect(dialog).toBeVisible();
        const photoSize = () =>
          dialog
            .locator('.photo-rail-slide:not([inert]) img')
            .first()
            .evaluate((img) => {
              const box = img.getBoundingClientRect();
              const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
              return {
                width: img.naturalWidth * scale,
                height: img.naturalHeight * scale,
                box: box.toJSON(),
              };
            });
        await expect
          .poll(() =>
            dialog
              .locator('.photo-rail-slide:not([inert]) img')
              .first()
              .evaluate(
                (img) =>
                  img.complete &&
                  img.naturalWidth > 0 &&
                  getComputedStyle(img).visibility !== 'hidden',
              ),
          )
          .toBe(true);
        await page.waitForTimeout(500);
        const portrait = await photoSize();
        const gallery = { portrait };
        if (mobile) {
          for (const size of [
            { width: 844, height: 390 },
            { width: 667, height: 375 },
            { width: 740, height: 320 },
          ]) {
            await page.setViewportSize(size);
            await page.waitForTimeout(500);
            gallery[`${size.width}x${size.height}`] = await photoSize();
            await dialog.screenshot({ path: path.join(output, `gallery-${size.width}.png`) });
            await expect(
              dialog.getByRole('button', { name: 'Fechar fotografia' }),
            ).toBeInViewport();
            assert.equal(
              await dialog.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
              false,
            );
          }
          await page.setViewportSize({ width: 390, height: 844 });
          await page.waitForTimeout(400);
          assert.ok(Math.abs((await photoSize()).width - portrait.width) < 1);
        }
        await dialog.getByRole('button', { name: 'Fechar fotografia' }).click();
        await expect(dialog).toHaveCount(0);
        results.push({ width, gallery });
      }
      const final = await page.evaluate(() => window.__slow);
      assert.deepEqual(errors, []);
      const appearance = process.env.SLOW_DEVICE_COMPARE_MOTION
        ? await verifyMotionAppearance(page, output, width)
        : undefined;
      results.push({ width, route, initial, scroll, final, appearance });
      await writeFile(path.join(output, 'results.json'), JSON.stringify({ results }, null, 2));
      console.log(
        JSON.stringify({
          width,
          route,
          cls: initial.cls,
          scroll,
          interactions: final.interactions,
        }),
      );
      await context.close();
    }
  }
  await writeFile(
    path.join(output, 'results.json'),
    JSON.stringify(
      {
        note: 'Production build; synthetic stock/photos; local origin only (third parties blocked); CPU 6x mobile / 4x desktop; network 1.6 Mbps and 120 ms. Event Timing samples are lab interactions, not field INP. Scroll is scripted, not a physical device.',
        results,
      },
      null,
      2,
    ),
  );
}
