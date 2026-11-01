// Isolated headless browser, synthetic photos and local requests only.
import assert from 'node:assert/strict';
import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';

const versions = Array.from({ length: 9 }, (_, index) => (index + 1).toString(16).padStart(64, '0'));
const pixels = await sharp({ create: { width: 8, height: 6, channels: 3, background: '#39735a' } })
  .webp({ quality: 84 }).toBuffer();
const server = await createServer({
  logLevel: 'error',
  plugins: [{
    name: 'isolated-photo-preparation-test',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/__photo_preparation_test') return next();
        res.setHeader('content-type', 'text/html');
        res.end('<!doctype html><html><body>Local photo preparation test</body></html>');
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0, fs: { allow: [path.resolve('../..'), await realpath('../../node_modules')] } },
});
let browser;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0].replace(/\/$/, '');
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  for (const [width, density, expected] of [[320, 1, 320], [390, 2, 800], [1440, 1, 1280]]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, deviceScaleFactor: density, serviceWorkers: 'block' });
    try {
      const requests = [], errors = [];
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) return route.abort();
        if (!url.pathname.startsWith('/viaturas/')) return route.continue();
        requests.push(url);
        if (url.pathname.endsWith('/photos/access'))
          return route.fulfill({ json: { versions } });
        const index = Number(url.pathname.split('/').at(-1));
        return route.fulfill({ body: pixels, contentType: 'image/webp', headers: { 'x-photo-version': versions[index] } });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/__photo_preparation_test');
      await page.evaluate(async () => {
        const photos = await import('/src/lib/publicThumbnail.ts');
        photos.warmNavigationThumbnails('test-abcdef123456', window.innerWidth, window.devicePixelRatio);
      });
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 10000;
        const check = () => {
          if (requests.length === 10) return resolve();
          if (Date.now() > deadline) return reject(new Error('Incomplete browser preparation'));
          setTimeout(check, 25);
        };
        check();
      });
      const images = requests.filter(url => !url.pathname.endsWith('/access'));
      assert.equal(images.length, 9);
      assert.equal(new Set(images.map(url => url.pathname)).size, 9);
      assert.ok(images.every(url => url.searchParams.get('w') === String(expected)));
      assert.ok(images.every(url => versions.includes(url.searchParams.get('v'))));
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ viewport: width, density, chosenWidth: expected, accessRequests: 1, imageRequests: images.length }));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
