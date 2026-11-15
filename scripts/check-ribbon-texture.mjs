import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import sharp from 'sharp';

const svg = await readFile(
  new URL('../shared/ui/promotion-ribbon-fabric.svg', import.meta.url),
  'utf8',
);
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.end(svg);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const dpr of [1, 2])
    for (const size of [
      [220, 44],
      [192, 40],
      [240, 54],
    ]) {
      const page = await browser.newPage({
        viewport: { width: 400, height: 200 },
        deviceScaleFactor: dpr,
      });
      const [width, height] = size;
      const shell = `<style>body{margin:0;background:#222}#frame{position:relative;width:${width}px;height:${height}px;margin:30px}#frame>*{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 2px 1px #3100083b) drop-shadow(0 5px 4px #00000024)}</style>`;
      await page.setContent(shell + `<div id="frame">${svg}</div>`);
      const before = await page.screenshot();
      await page.setContent(
        shell +
          `<div id="frame"><img src="http://127.0.0.1:${server.address().port}/fabric.svg"></div>`,
      );
      await page.locator('img').evaluate((img) => img.decode());
      const after = await page.screenshot();
      const a = await sharp(before).raw().toBuffer(),
        b = await sharp(after).raw().toBuffer();
      let error = 0;
      for (let i = 0; i < a.length; i++) error += Math.abs(a[i] - b[i]);
      const mae = error / a.length;
      console.log({ dpr, size, mae });
      assert(mae < 0.1, 'External SVG must preserve the approved fabric rendering');
      await page.close();
    }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
