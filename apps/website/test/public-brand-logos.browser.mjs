// Built public website + public API fixtures only. No CRM authentication, DB writes or real emails.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const app = path.resolve(process.env.WEBSITE_BUILD_ROOT || '.');
const slug = 'nissan-legacy-aaaaaaaaaaaa';
let label = 'Nissan';
const vehicle = () => ({
  slug,
  brand: label,
  model: 'Qashqai',
  year: 2020,
  fuel: 'DIESEL',
  mileage: 42000,
  price: '20000.00',
  currency: 'EUR',
  description: 'Viatura de teste legado.',
  transmission: 'MANUAL',
  availability: 'AVAILABLE',
  photos: [],
});
const brands = () => [
  { value: label, count: 1 },
  { value: 'BYD', count: 1 },
  { value: 'XEV', count: 1 },
];
let apiReads = 0;
const api = createServer((req, res) => {
  assert.equal(req.method, 'GET');
  apiReads++;
  const u = new URL(req.url, 'http://fixture');
  let data;
  if (u.pathname.endsWith('/brands')) data = brands();
  else if (u.pathname.endsWith('/homepage-highlights')) data = { configured: true, items: [] };
  else if (u.pathname.endsWith('/related')) data = [];
  else if (u.pathname.endsWith('/' + slug)) data = vehicle();
  else
    data = {
      items: [vehicle()],
      total: 1,
      page: 1,
      pageSize: 9,
      totalPages: 1,
      facets: {
        brands: brands(),
        models: [{ value: 'Qashqai', brand: label, count: 1 }],
        fuels: [{ value: 'DIESEL', count: 1 }],
        transmissions: [{ value: 'MANUAL', count: 1 }],
        year: { min: 2020, max: 2020 },
        mileage: { min: 42000, max: 42000 },
        price: { min: '20000.00', max: '20000.00' },
      },
    };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
});
await new Promise((r) => api.listen(0, '127.0.0.1', r));
const reserve = createServer();
await new Promise((r) => reserve.listen(0, '127.0.0.1', r));
const port = reserve.address().port;
await new Promise((r) => reserve.close(r));
const origin = 'http://127.0.0.1:' + port;
const child = spawn(
  process.env.RUNTIME_NODE || process.execPath,
  [path.join(app, 'build/index.js')],
  {
    cwd: app,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      ORIGIN: origin,
      INTERNAL_BACKEND_URL: 'http://127.0.0.1:' + api.address().port,
      CONTACT_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let logs = '';
child.stdout.on('data', (d) => (logs += d));
child.stderr.on('data', (d) => (logs += d));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try {
      if ((await fetch(origin)).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(ready, 'built website started');
  const output = path.resolve(
    process.env.SCREENSHOT_DIR || '.svelte-kit/public-brand-logos-review',
  );
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'chrome',
  });
  for (const width of [390, 1366])
    for (const legacy of [false, true]) {
      label = legacy ? '  nIsSaN  ' : 'Nissan';
      for (const route of ['/', '/viaturas/' + slug]) {
        const response = await fetch(origin + route);
        assert.equal(response.status, 200);
        const html = await response.text();
        const match = html.match(/<img[^>]*src="([^"]*nissan[^\"]*\.svg)"[^>]*>/i);
        assert.ok(match, 'SSR Nissan logo on ' + route);
        const image = await fetch(new URL(match[1], origin));
        assert.equal(image.status, 200);
        assert.match(image.headers.get('content-type'), /image\/svg\+xml/);
        const actual = (await image.text()).replace(/\r\n/g, '\n');
        const expected = (
          await readFile(path.join(app, '../crm/src/lib/assets/brands/nissan.svg'), 'utf8')
        ).replace(/\r\n/g, '\n');
        assert.equal(actual, expected, 'built asset is verified real Nissan SVG');
      }
      const context = await browser.newContext({
        viewport: { width, height: 950 },
        reducedMotion: 'reduce',
      });
      await context.addInitScript(
        (theme) => {
          localStorage.setItem('anm-orbit-theme', theme);
        },
        width === 390 ? 'dark' : 'light',
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
      );
      await page.goto(origin);
      const section = page.locator('section.stock-brands');
      const nissan = section
        .locator('a')
        .filter({ hasText: /nissan/i })
        .first();
      if (width > 700) {
        await section.scrollIntoViewIfNeeded();
        const logo = nissan.locator('img.brand-logo');
        await logo.evaluate((img) => {
          img.loading = 'eager';
          return img.decode();
        });
        assert.ok(await logo.evaluate((img) => img.naturalWidth > 0));
        assert.ok(await nissan.isVisible());
        const fallback = section.locator('a').filter({ hasText: 'XEV' }).first();
        assert.equal(await fallback.locator('img').count(), 0);
        assert.ok(await fallback.isVisible());
        const byd = section.locator('a').filter({ hasText: 'BYD' }).first().locator('img');
        await byd.evaluate((img) => {
          img.loading = 'eager';
          return img.decode();
        });
        if (!legacy)
          await section.screenshot({ path: path.join(output, 'public-brands-' + width + '.png') });
      } else {
        assert.equal(
          await section.isVisible(),
          false,
          'preserve existing mobile layout: brand directory is desktop only',
        );
        const select = page.locator('#home-brand');
        await select.scrollIntoViewIfNeeded();
        await select.click();
        const option = page
          .getByRole('option')
          .filter({ hasText: /nissan/i })
          .first();
        const logo = option.locator('img');
        await logo.evaluate((img) => img.decode());
        assert.ok(await logo.evaluate((img) => img.naturalWidth > 0));
        if (!legacy)
          await page
            .locator('.home-basic-filters')
            .screenshot({ path: path.join(output, 'public-brands-' + width + '.png') });
        await page.keyboard.press('Escape');
      }
      await page.goto(origin + '/viaturas/' + slug);
      const facts = page.locator('.detail-facts');
      await facts.scrollIntoViewIfNeeded();
      const spec = facts.locator('img.spec-brand-logo');
      await spec.evaluate((img) => {
        img.loading = 'eager';
        return img.decode();
      });
      assert.ok(await spec.evaluate((img) => img.naturalWidth > 0));
      assert.match(await facts.innerText(), /nissan/i);
      if (!legacy)
        await facts.screenshot({ path: path.join(output, 'public-detail-' + width + '.png') });
      if (width === 1366 && legacy) {
        await page.route('**/*nissan*.svg', (route) => route.abort());
        await page.reload();
        await facts.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          () => !document.querySelector('.detail-facts img.spec-brand-logo'),
        );
        assert.ok(
          (await facts.locator('dt').filter({ hasText: 'Marca' }).locator('svg').count()) > 0,
        );
        await page.goto(origin);
        await section.scrollIntoViewIfNeeded();
        await page.waitForFunction(() =>
          [...document.querySelectorAll('.stock-brands a')]
            .filter((a) => /nissan/i.test(a.textContent))
            .every((a) => !a.querySelector('img')),
        );
        assert.ok(await nissan.isVisible());
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log(
        'PASS built public Nissan SSR/static200 + brands/detail ' + width + 'px legacy=' + legacy,
      );
    }
  assert.ok(apiReads > 0);
  console.log('All fixture API requests were GET; no business data changed.');
} finally {
  await browser?.close();
  child.kill('SIGTERM');
  await new Promise((r) => {
    if (child.exitCode !== null) r();
    else child.once('exit', r);
  });
  await new Promise((r) => api.close(r));
}
