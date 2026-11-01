// Valid synthetic Blob photos, isolated headless browser, no live API or user files.
import assert from 'node:assert/strict';
import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { createServer as httpServer } from 'node:http';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
const reserve = httpServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const pixels = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#39735a' } }).png().toBuffer();
const vite = await createServer({
  logLevel: 'error',
  plugins: [{ name: 'local-preview-fixture', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/__local_preview_test') return next();
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><html><body></body></html>');
    });
  } }],
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [path.resolve('../..'), await realpath('../../node_modules')] } },
});
let browser;
try {
  await vite.listen();
  const origin = `http://127.0.0.1:${port}`;
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(origin + '/__local_preview_test');
  const result = await page.evaluate(async bytes => {
    const { reusablePhoto } = await import('/src/lib/reusablePhoto.ts');
    const urls = Array.from({ length: 14 }, () => URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' })));
    const original = HTMLImageElement.prototype.decode;
    let candidateAttempts = 0;
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected && this.src === urls[12] && ++candidateAttempts === 1)
        return Promise.reject(new DOMException('Synthetic transient decode failure', 'EncodingError'));
      return original.call(this);
    };
    const nodes = urls.map((url, index) => {
      const node = document.createElement('img'); node.alt = `Fotografia ${index + 1}`;
      node.style.width = '160px'; document.body.append(node);
      return { node, action: reusablePhoto(node, { photo: { url } }) };
    });
    await new Promise(resolve => setTimeout(resolve, 200));
    window.dispatchEvent(new Event('resize'));
    await new Promise(resolve => setTimeout(resolve, 200));
    const result = { loaded: nodes.filter(x => x.node.naturalWidth > 0).length, failedIndexes: nodes.flatMap((x, i) => x.node.naturalWidth ? [] : [i + 1]), candidateAttempts };
    HTMLImageElement.prototype.decode = original;
    nodes.forEach(x => x.action.destroy()); urls.forEach(url => URL.revokeObjectURL(url));
    return result;
  }, [...pixels]);
  console.log(JSON.stringify(result));
  assert.equal(result.loaded, 14, 'A valid local preview must recover from one transient decode failure');
  assert.equal(result.candidateAttempts, 2, 'Recovery must be bounded to one retry');
  const permanent = await page.evaluate(async bytes => {
    const { reusablePhoto } = await import('/src/lib/reusablePhoto.ts');
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const original = HTMLImageElement.prototype.decode; let attempts = 0;
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected && this.src === url) { attempts++; return Promise.reject(new DOMException('Persistent fixture failure', 'EncodingError')); }
      return original.call(this);
    };
    const node = document.createElement('img'); document.body.append(node);
    const action = reusablePhoto(node, { photo: { url } });
    await new Promise(resolve => setTimeout(resolve, 150));
    for (let index = 0; index < 3; index++) { window.dispatchEvent(new Event('resize')); await new Promise(resolve => setTimeout(resolve, 30)); }
    action.destroy(); HTMLImageElement.prototype.decode = original; URL.revokeObjectURL(url);
    return attempts;
  }, [...pixels]);
  assert.equal(permanent, 2, 'A permanent failure must not create an automatic retry loop');
  const replacement = await page.evaluate(async bytes => {
    const { reusablePhoto } = await import('/src/lib/reusablePhoto.ts');
    const urls = [0, 1].map(() => URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' })));
    const original = HTMLImageElement.prototype.decode; let release;
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected && this.src === urls[0]) return new Promise(resolve => { release = resolve; });
      return original.call(this);
    };
    const node = document.createElement('img'); document.body.append(node);
    const photo = { url: urls[0] }, action = reusablePhoto(node, { photo });
    await new Promise(resolve => setTimeout(resolve, 50));
    photo.url = urls[1]; action.update({ photo }); URL.revokeObjectURL(urls[0]);
    await new Promise(resolve => setTimeout(resolve, 100)); release();
    await new Promise(resolve => setTimeout(resolve, 50));
    const correct = node.src === urls[1] && node.naturalWidth === 16;
    action.destroy(); HTMLImageElement.prototype.decode = original; URL.revokeObjectURL(urls[1]);
    return correct;
  }, [...pixels]);
  assert.equal(replacement, true, 'Old decoding must not replace a newer local preview');
  await page.route('**/fixture-*.png', route => route.fulfill({ body: pixels, contentType: 'image/png' }));
  const remote = await page.evaluate(async origin => {
    const { reusablePhoto } = await import('/src/lib/reusablePhoto.ts');
    const original = HTMLImageElement.prototype.decode; let small = 0, master = 0;
    HTMLImageElement.prototype.decode = function () {
      if (!this.isConnected && this.src.endsWith('/fixture-small.png')) { small++; return Promise.reject(new DOMException('Missing derivative', 'EncodingError')); }
      if (!this.isConnected && this.src.endsWith('/fixture-master.png')) master++;
      return original.call(this);
    };
    const node = document.createElement('img'); document.body.append(node);
    const action = reusablePhoto(node, { photo: { url: origin + '/fixture-master.png', width: 1600, variants: [{ url: origin + '/fixture-small.png', width: 320 }] } });
    await new Promise(resolve => setTimeout(resolve, 150));
    const result = { small, master, loaded: node.naturalWidth === 16 };
    action.destroy(); HTMLImageElement.prototype.decode = original;
    return result;
  }, origin);
  assert.deepEqual(remote, { small: 1, master: 1, loaded: true });
  console.log(JSON.stringify({ permanentAttempts: permanent, replacementPreserved: replacement }));
  await context.close();
} finally { await browser?.close(); await vite.close(); }
