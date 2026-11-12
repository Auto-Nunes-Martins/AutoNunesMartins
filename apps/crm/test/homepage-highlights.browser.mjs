import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import { chromium } from '@playwright/test';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { createServer } from 'vite';

test('highlights wait for thumbnail pixels, then load galleries and keep the desktop crop', { timeout: 60_000 }, async () => {
  const crm = fileURLToPath(new URL('../', import.meta.url));
  const output = path.join(crm, '.svelte-kit');
  await mkdir(output, { recursive: true });
  const directory = await mkdtemp(path.join(output, 'highlights-fixture-'));
  const a = 'c123456789012345678901234', b = 'c223456789012345678901234';
  const first = `${a}/first.jpg`, selected = `${a}/selected.jpg`, second = `${b}/first.jpg`;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="900"><rect width="400" height="450" fill="red"/><rect y="450" width="400" height="450" fill="blue"/></svg>';
  const src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  const editor = { revision: null, items: [{ vehicleId: a, photoPath: selected }], candidates: [
    { id: a, brand: 'BMW', model: 'One', year: 2020, photoPaths: [first, selected],
      coverFraming: { desktop: { x: 23, y: 79 }, mobile: { x: 67, y: 14 } } },
    { id: b, brand: 'Audi', model: 'Two', year: 2022, photoPaths: [second] },
  ] };
  await Promise.all(Object.entries({
    'paths.js': "export const base = '';",
    'forms.js': 'export const enhance = () => ({}); export const applyAction = async () => {};',
    'index.html': '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module" src="/client.js"></script>',
    'review.css': "@import '../../src/app.css';\n@source '../../src';",
    'client.js': "import './review.css'; import { mount } from 'svelte'; import App from './App.svelte'; mount(App, {target:document.querySelector('#app')});",
    'App.svelte': `<script>import Editor from '$lib/components/vehicle/HomepageHighlightsEditor.svelte'; import {bindCrmSession} from '$lib/auth/session'; bindCrmSession(async () => 'fixture-token', () => 'fixture');</script><Editor editor={${JSON.stringify(editor)}} selectedVehicleId={new URLSearchParams(location.search).get('viatura')}/>`,
  }).map(([name, data]) => writeFile(path.join(directory, name), data)));

  const server = await createServer({
    configFile: false, root: directory, plugins: [tailwindcss(), svelte({ configFile: false })], logLevel: 'error',
    resolve: { alias: { '$lib': path.join(crm, 'src/lib'), '$app/paths': path.join(directory, 'paths.js'), '$app/forms': path.join(directory, 'forms.js') } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [path.resolve(crm, '../..')] } },
  });
  let browser;
  let releasePreviews, releasePixels, releaseFirstGallery;
  const previewDelay = new Promise((resolve) => { releasePreviews = resolve; });
  const pixelDelay = new Promise((resolve) => { releasePixels = resolve; });
  const firstDelay = new Promise((resolve) => { releaseFirstGallery = resolve; });
  try {
    await server.listen();
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || undefined });
    const page = await browser.newPage({ viewport: { width: 1400, height: 1050 } });
    const galleryIds = [], previewPaths = [];
    let failedPath;
    await page.route('**/fixture-broken.svg', (route) => route.fulfill({ status: 404, body: '' }));
    await page.route('**/fixture-thumbnail.svg', async (route) => {
      await pixelDelay;
      return route.fulfill({ contentType: 'image/svg+xml', body: svg });
    });
    await page.route('**/site/destaques/fotografias?*', async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const id = params.get('viatura');
      if (!id) {
        const paths = params.getAll('path');
        previewPaths.push(...paths);
        await previewDelay;
        return route.fulfill({ json: { photos: paths.filter((path) => path !== failedPath).map((path) => ({ path, url: path === selected ? '/fixture-broken.svg' : '/fixture-thumbnail.svg', originalUrl: src })) } });
      }
      galleryIds.push(id);
      if (id === a) await firstDelay;
      if (id === b && galleryIds.filter((value) => value === b).length === 1)
        return route.fulfill({ status: 503, json: { error: 'Fixture Storage offline' } });
      return route.fulfill({ json: { photos: (id === a ? [first, selected] : [second]).map((path) => ({ path, url: src, width: 400, height: 900 })) } });
    });
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    await page.goto(origin);
    const row = (id) => page.locator(`[data-highlight-vehicle="${id}"]`);
    const waiting = page.getByText('A carregar as fotografias dos destaques…');
    await waiting.waitFor();
    assert.equal(await row(a).isVisible(), false);
    assert.equal(await page.locator('.candidate').first().isVisible(), false);
    assert.deepEqual(galleryIds, []);
    const imageRequest = page.waitForRequest('**/fixture-thumbnail.svg');
    releasePreviews();
    await imageRequest;
    assert.equal(await row(a).isVisible(), false, 'signed URLs alone must not reveal the list');
    assert.equal(await page.locator('.candidate').first().isVisible(), false);
    assert.equal(await waiting.isVisible(), true);
    releasePixels();
    await row(a).locator('.cover img').waitFor();
    await page.locator('.candidate-placeholder img').last().waitFor();
    assert.equal(await row(a).locator('.cover img').getAttribute('src'), src, 'a broken miniature uses the decoded original before reveal');
    assert.deepEqual(await page.locator('img[data-highlight-preview]').evaluateAll((images) => images.map((img) => img.naturalWidth)), [400, 400, 400]);
    assert.deepEqual(new Set(previewPaths), new Set([first, selected, second]));
    assert.deepEqual(galleryIds, []);

    const thumbnails = page.locator('.candidate-placeholder img');
    const position = (image) => image.evaluate((img) => getComputedStyle(img).objectPosition);
    const catalogue = page.getByRole('region', { name: 'Catálogo de viaturas' });
    await catalogue.getByRole('heading', { name: 'Adicionar viaturas' }).waitFor();
    const chosen = catalogue.getByRole('button', { name: 'BMW One adicionada' });
    const addAudi = catalogue.getByRole('button', { name: 'Adicionar Audi Two' });
    assert.equal(await chosen.isDisabled(), true);
    assert.equal(await chosen.locator('svg.lucide-check').count(), 1);
    assert.equal(await addAudi.locator('svg.lucide-plus').count(), 1);
    assert.equal(await position(thumbnails.first()), '23% 79%');
    assert.equal(await position(thumbnails.last()), '50% 50%');
    if (process.env.CAMPAIGN_PREVIEW === '1') {
      await catalogue.screenshot({ path: path.join(output, 'destaques-catalogo-1400.png') });
    }
    await page.setViewportSize({ width: 390, height: 760 });
    assert.equal(await position(thumbnails.first()), '67% 14%');
    if (process.env.CAMPAIGN_PREVIEW === '1') {
      await catalogue.screenshot({ path: path.join(output, 'destaques-catalogo-390.png') });
    }
    const search = page.getByRole('searchbox', { name: 'Pesquisar viaturas publicadas' });
    await search.fill('2022');
    await page.getByRole('button', { name: 'Adicionar Audi Two' }).waitFor();
    assert.equal(await page.locator('.candidate').count(), 1);
    await search.clear();
    await page.setViewportSize({ width: 1400, height: 1050 });

    const toggle = (id, name) => row(id).getByRole('button', { name, exact: true });
    const photoAction = toggle(a, 'Escolher fotografia');
    await photoAction.hover();
    const hover = await photoAction.evaluate((button) => {
      const style = getComputedStyle(button);
      return {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderTopWidth,
        shadow: style.boxShadow,
      };
    });
    assert.deepEqual(hover, {
      color: 'rgb(255, 255, 255)',
      background: 'rgba(0, 0, 0, 0)',
      border: '0px',
      shadow: 'none',
    });
    await photoAction.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(
      await photoAction.evaluate(
        (button) => button.matches(':focus-visible') && getComputedStyle(button).outlineWidth === '2px',
      ),
      true,
    );
    await page.keyboard.press('Enter');
    await row(a).getByText('A carregar fotografias…').waitFor();
    await toggle(a, 'Fechar fotografias').click();
    await toggle(a, 'Escolher fotografia').click();
    assert.equal(await row(a).locator('.cover img').count(), 1);
    await page.getByRole('button', { name: 'Adicionar Audi Two' }).click();
    await toggle(b, 'Tentar novamente').click();
    await row(b).getByRole('slider').waitFor();
    releaseFirstGallery();
    await toggle(a, 'Escolher fotografia').click();
    const frame = row(a).getByRole('slider');
    await frame.waitFor();
    await frame.focus();
    await page.keyboard.press('End');
    const crop = (image) => image.evaluate((img) => {
      const { width, height } = img.getBoundingClientRect();
      const fitted = img.naturalHeight * width / img.naturalWidth;
      return { ratio: width / height, cover: getComputedStyle(img).objectFit, focus: getComputedStyle(img).objectPosition, overflow: fitted / height };
    });
    const cardImage = row(a).locator('.cover img');
    await frame.locator('img').evaluate((image) => image.decode());
    const card = await crop(cardImage), large = await crop(frame.locator('img'));
    assert.equal(card.focus, '50% 100%');
    assert.equal(card.focus, large.focus);
    assert.equal(card.cover, 'cover');
    assert.ok(card.overflow > 2 && Math.abs(card.overflow - large.overflow) < 0.04,
      `The card and desktop editor use the same cover crop: ${JSON.stringify({ card, large })}`);
    await row(a).getByRole('button', { name: 'Telemóvel' }).click();
    await frame.focus();
    await page.keyboard.press('Home');
    assert.equal((await crop(cardImage)).focus, '50% 100%');
    await toggle(a, 'Fechar fotografias').click();
    await toggle(a, 'Escolher fotografia').click();
    assert.deepEqual(galleryIds, [a, b, b]);
    assert.equal((await crop(cardImage)).focus, '50% 100%');

    galleryIds.length = 0;
    failedPath = first;
    await page.goto(`${origin}/?viatura=${b}`);
    const retryPreview = page.getByRole('button', { name: 'Tentar carregar a miniatura novamente' });
    await retryPreview.waitFor();
    await row(b).locator('.cover img').waitFor();
    assert.equal(await row(a).locator('.cover img').count(), 1);
    assert.deepEqual(galleryIds, [], 'the contextual link prepares the selection without opening a gallery');
    failedPath = undefined;
    await retryPreview.click();
    await page.locator('.candidate-placeholder img').first().waitFor();
    assert.equal(await retryPreview.count(), 0);
  } finally {
    releasePreviews();
    releasePixels();
    releaseFirstGallery();
    await browser?.close();
    await server.close();
  }
});
