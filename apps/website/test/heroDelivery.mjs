import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Local production build and synthetic stock; keep each run for comparison.
export async function heroDelivery(browser, origin) {
  const output = path.resolve(
    process.env.HERO_DELIVERY_OUTPUT || `../../.cache/hero-delivery-${Date.now()}`,
  );
  await mkdir(output, { recursive: true });
  const baseline = process.env.HERO_DELIVERY_BASELINE
    ? JSON.parse(await readFile(path.resolve(process.env.HERO_DELIVERY_BASELINE), 'utf8'))
    : [];
  const rows = [];
  for (const [width, height, dpr] of [
    [320, 568, 2],
    [375, 667, 2],
    [390, 844, 2],
    [412, 823, 1.5],
    [430, 932, 3],
    [540, 720, 2],
    [700, 950, 1],
    [701, 950, 1],
    [1050, 900, 1],
    [1440, 900, 1],
    [1564, 917, 1.5],
    [1920, 1080, 1],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      isMobile: width <= 700,
      hasTouch: width <= 700,
    });
    await context.route('**/*', (r) =>
      new URL(r.request().url()).origin === origin ? r.continue() : r.abort(),
    );
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator('.hd-root[data-canvas-pinned]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.hd-landscape img').evaluate((img) => img.decode());
    const image = await page.locator('.hd-landscape img').evaluate((img) => {
      const p = img.closest('picture');
      const source = [...p.querySelectorAll('source')].find(
        (s) => (!s.media || matchMedia(s.media).matches) && s.type === 'image/avif',
      );
      return {
        url: img.currentSrc,
        imageWidth: img.offsetWidth,
        imageHeight: img.offsetHeight,
        sizes: source?.sizes,
        maximum: Math.max(
          ...(source?.srcset || img.srcset)
            .split(',')
            .map((s) => Number(s.trim().split(' ').at(-1).slice(0, -1))),
        ),
      };
    });
    const bytes = Buffer.from(await (await context.request.get(image.url)).body());
    const meta = await sharp(bytes).metadata();
    // Allow for the complete approved 1.055 entry zoom, even if it has already settled.
    const requiredWidth =
      Math.max(image.imageWidth, (image.imageHeight * meta.width) / meta.height) * 1.055;
    const density = meta.width / requiredWidth;
    rows.push({
      width,
      height,
      dpr,
      ...image,
      url: new URL(image.url).pathname,
      bytes: bytes.length,
      sourceWidth: meta.width,
      sourceHeight: meta.height,
      requiredWidth,
      density,
    });
    console.log(JSON.stringify(rows.at(-1)));
    assert.ok(
      meta.width === image.maximum || density >= dpr * 0.97,
      `Image undersized at ${width}x${height}: ${density} < ${dpr}`,
    );
    await page.locator('.hd-landscape picture').evaluate((p) =>
      p.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 4800;
      }),
    );
    await page.screenshot({
      path: path.join(output, `${width}-${height}.png`),
      animations: 'disabled',
    });
    const previous = baseline.find(
      (r) => r.width === width && r.height === height && r.dpr === dpr,
    );
    if (previous && previous.url !== new URL(image.url).pathname) {
      // Compare only the wallpaper in the same DOM/frame. The foreground is
      // made invisible (still occupies its space), with every animation frozen.
      await page.evaluate(() => {
        document.getAnimations().forEach((a) => a.pause());
        document
          .querySelectorAll('.hd-root > :not(.hd-landscape)')
          .forEach((n) => (n.style.visibility = 'hidden'));
        scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.waitForTimeout(150);
      const current = await page.screenshot({
        path: path.join(output, `${width}-wallpaper-after.png`),
      });
      await page.locator('.hd-landscape picture').evaluate(async (p, url) => {
        const img = p.querySelector('img');
        const selected = [...p.querySelectorAll('source')].find(
          (s) => (!s.media || matchMedia(s.media).matches) && s.type === 'image/avif',
        );
        selected.srcset = url;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await img.decode();
      }, previous.url);
      const old = await page.screenshot({
        path: path.join(output, `${width}-wallpaper-before.png`),
      });
      const a = await sharp(current).removeAlpha().raw().toBuffer();
      const b = await sharp(old).removeAlpha().raw().toBuffer();
      assert.equal(a.length, b.length, 'Wallpaper layout changed');
      let error = 0;
      for (let i = 0; i < a.length; i++) error += Math.abs(a[i] - b[i]);
      rows.at(-1).wallpaperMeanPixelDifference = error / a.length;
      console.log(`Rendered wallpaper ${width}: mean difference ${error / a.length}/255`);
    }
    await context.close();
  }
  await writeFile(path.join(output, 'results.json'), JSON.stringify(rows, null, 2));
  console.log(`Hero delivery: ${output}`);
}
