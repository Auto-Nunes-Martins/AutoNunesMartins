import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';
import sharp from 'sharp';

export async function galleryRotation(browser, origin, slug) {
  const output = path.resolve(
    process.env.GALLERY_ROTATION_OUTPUT || '../../.cache/gallery-rotation',
  );
  await mkdir(output, { recursive: true });
  const dimensions = [
    [1600, 900],
    [900, 1200],
    [1600, 1067],
  ];
  const photos = await Promise.all(
    dimensions.map(([width, height], index) =>
      sharp(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#536662"/><rect x="5" y="5" width="${width - 10}" height="${height - 10}" fill="none" stroke="white" stroke-width="10"/><circle cx="${width / 2}" cy="${height / 2}" r="180" fill="#ab3337"/><text x="30" y="80" fill="white" font-size="50">Fotografia ${index + 1}</text></svg>`,
        ),
      )
        .png()
        .toBuffer(),
    ),
  );
  const results = [];
  for (const [width, height] of [
    [390, 844],
    [375, 667],
    [320, 740],
    [430, 932],
  ]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        reducedMotion,
      });
      await context.route('**/*', (r) => {
        const url = new URL(r.request().url());
        if (url.pathname.endsWith('/photos/access'))
          return r.fulfill({ json: { versions: [1, 2, 3].map((n) => String(n).repeat(64)) } });
        if (url.pathname.includes('/photos/'))
          return r.fulfill({
            contentType: 'image/png',
            headers: { 'x-photo-version': url.searchParams.get('v') },
            body: photos[Number(url.pathname.split('/').at(-1))],
          });
        return url.origin === origin ? r.continue() : r.abort();
      });
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + '/viaturas/' + slug, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Abrir em ecrã inteiro', exact: true }).click();
      const dialog = page.locator('.gallery-dialog[open]');
      const readPhoto = () =>
        dialog
          .locator('.photo-rail-slide:not([inert]) img')
          .first()
          .evaluate((img) => {
            const rect = img.getBoundingClientRect(),
              scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
            return {
              width: img.naturalWidth * scale,
              height: img.naturalHeight * scale,
              fit: getComputedStyle(img).objectFit,
              box: rect.toJSON(),
            };
          });
      await expect.poll(() => readPhoto().then((p) => p.width > 0)).toBe(true);
      await page.waitForTimeout(450);
      const portrait = await readPhoto();
      await page.setViewportSize({ width: height, height: width });
      await page.waitForTimeout(450);
      const landscape = await readPhoto();
      assert.equal(landscape.fit, 'contain');
      assert.ok(landscape.width > portrait.width, 'horizontal image is larger after rotation');
      assert.ok(landscape.box.height >= width - 17, 'photo uses the entire safe height');
      const close = dialog.getByRole('button', { name: 'Fechar fotografia' });
      await expect(close).toBeInViewport();
      const closeBox = await close.boundingBox();
      assert.ok(closeBox.width >= 44 && closeBox.height >= 44);
      const stageBox = await dialog.locator('.viewer-stage').boundingBox();
      assert.ok(closeBox.x >= stageBox.x + stageBox.width, 'controls remain outside the image');
      await dialog.getByRole('button', { name: 'Ver fotografia 2', exact: true }).click();
      await expect.poll(() => readPhoto().then((p) => p.width / p.height)).toBeCloseTo(0.75, 2);
      await expect(dialog.locator('.viewer-photo-position')).toHaveText('2 / 3');
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(450);
      await expect(dialog.locator('.viewer-photo-position')).toHaveText('2 / 3');
      await dialog.getByRole('button', { name: 'Ver fotografia 1', exact: true }).click();
      await expect.poll(() => readPhoto().then((p) => p.width)).toBeCloseTo(portrait.width, 0);
      await page.setViewportSize({ width: height, height: width });
      await page.waitForTimeout(450);
      await dialog.screenshot({
        path: path.join(output, `${height}x${width}-${reducedMotion}.png`),
      });
      // Contact slide, keyboard navigation, close and focus restoration survive rotation.
      await page.keyboard.press('ArrowRight');
      await expect(dialog.locator('.viewer-photo-position')).toHaveText('2 / 3');
      await dialog.getByRole('button', { name: 'Fale connosco', exact: true }).click();
      await expect(dialog.locator('.gallery-contact-slide')).toBeVisible();
      await close.click();
      await expect(dialog).toHaveCount(0);
      assert.equal(
        await page.evaluate(() => document.activeElement?.closest('[inert]') !== null),
        false,
      );
      assert.deepEqual(errors, []);
      results.push({ width, height, reducedMotion, portrait, landscape });
      await context.close();
      console.log(
        `Gallery rotation ${width}x${height} ${reducedMotion}: full photo and controls passed`,
      );
    }
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
}
