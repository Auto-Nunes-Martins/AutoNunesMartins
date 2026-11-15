// node --import tsx backend/test/socialFraming.browser.mjs
// Local synthetic photos only; no CRM, Storage or public-data mutations.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { renderSocialPhoto } from '../src/lib/server/socialImages.ts';

const output = new URL('../../.cache/social-preview/framing/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'chrome',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1260, height: 900 },
  deviceScaleFactor: 1,
});
const results = [];
try {
  for (const [width, height] of [
    [630, 900],
    [1400, 900],
    [2000, 700],
  ]) {
    const shapes = Array.from(
      { length: 20 },
      (_, i) =>
        `<rect x="${(i * width) / 20}" y="0" width="${width / 20}" height="${height}" fill="hsl(${i * 18},60%,55%)"/><rect x="0" y="${(i * height) / 20}" width="${width}" height="3" fill="#fff"/>`,
    ).join('');
    const input = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}<circle cx="${width * 0.3}" cy="${height * 0.72}" r="${height * 0.12}" fill="#202026"/><circle cx="${width * 0.7}" cy="${height * 0.72}" r="${height * 0.12}" fill="#202026"/></svg>`,
      ),
    )
      .png()
      .toBuffer();
    for (const position of [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      { x: 27, y: 73, zoom: 1.5 },
      { x: 50, y: 50, zoom: 3 },
    ]) {
      const name = `${width}x${height}-${position.x}-${position.y}-${position.zoom ?? 1}`;
      await page.setContent(
        `<style>body{margin:0;background:#101112}.frame{width:1260px;height:900px;overflow:hidden}img{width:100%;height:100%;object-fit:cover;object-position:${position.x}% ${position.y}%;transform-origin:${position.x}% ${position.y}%;transform:scale(${position.zoom ?? 1})}</style><div class="frame"><img src="data:image/png;base64,${input.toString('base64')}"></div>`,
      );
      await page.locator('img').evaluate((image) => image.decode());
      const reference = await page.screenshot();
      const rendered = await renderSocialPhoto(input, position);
      // Compare composition at preview size, not JPEG ringing versus Chrome's
      // interpolation along the deliberately high-contrast synthetic grid.
      const expected = await sharp(reference).resize(420, 300).removeAlpha().raw().toBuffer();
      const actual = await sharp(rendered).resize(420, 300).removeAlpha().raw().toBuffer();
      // The intentional lower-right brand overlay is checked separately; compare
      // the photograph outside that corner to the browser's unchanged crop.
      const inBrandCorner = (i) => (i / 3) % 420 >= 287 && Math.floor(i / 3 / 420) >= 225;
      let error = 0,
        samples = 0;
      for (let i = 0; i < actual.length; i += 3) {
        if (inBrandCorner(i)) continue;
        for (let c = 0; c < 3; c++) error += Math.abs(actual[i + c] - expected[i + c]);
        samples += 3;
      }
      const meanError = error / samples;
      // Dark circular landmarks measure the actual placement/scale independently
      // of JPEG and browser interpolation on the white one-pixel grid lines.
      let intersection = 0,
        union = 0;
      for (let i = 0; i < actual.length; i += 3) {
        if (inBrandCorner(i)) continue;
        const a = actual[i] < 50 && actual[i + 1] < 50 && actual[i + 2] < 50;
        const b = expected[i] < 50 && expected[i + 1] < 50 && expected[i + 2] < 50;
        if (a && b) intersection++;
        if (a || b) union++;
      }
      const overlap = union ? intersection / union : 1;
      await writeFile(new URL(`${name}-browser.png`, output), reference);
      await writeFile(new URL(`${name}-social.jpg`, output), rendered);
      assert.ok(overlap >= 0.98, `${name}: landmark placement/scale differs from CSS (${overlap})`);
      assert.ok(meanError < 5.1, `${name}: RGB error exceeds 2% (${meanError})`);
      results.push({ name, meanError, overlap });
    }
  }
  await writeFile(new URL('results.json', output), JSON.stringify(results, null, 2));
  console.log(
    `${results.length} CSS versus generated-image crops passed. Maximum mean RGB error: ${Math.max(...results.map((r) => r.meanError)).toFixed(3)} / 255.`,
  );
} finally {
  await browser.close();
}
