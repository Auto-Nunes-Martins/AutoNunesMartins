import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
test('fiscal period selector separates payable, deductible and credit at desktop and mobile widths', async () => {
  await mkdir(path.join(root, '.svelte-kit'), { recursive: true });
  const dir = await mkdtemp(path.join(root, '.svelte-kit', 'document-vat-browser-'));
  await writeFile(
    path.join(dir, 'index.html'),
    '<div id="app"></div><script type="module" src="/main.js"></script>',
  );
  await writeFile(
    path.join(dir, 'main.js'),
    "import {mount} from 'svelte';import App from './App.svelte';mount(App,{target:document.getElementById('app')});",
  );
  await writeFile(
    path.join(dir, 'App.svelte'),
    `<script>import VatSummary from '$lib/components/dashboard/VatSummary.svelte';const data={months:[{month:'2025-12',payable:'1121.95',deductible:'0',balance:'1121.95'},{month:'2026-01',payable:'23',deductible:'230',balance:'-207'}],pendingDocuments:2};</script><VatSummary {data} monthKeys={['2025-12','2026-01']}/><style>:global(body){font-family:Arial;background:#151515;color:#eee;margin:20px}:global(select){color:#111}</style>`,
  );
  const vite = await createServer({
    configFile: false,
    root: dir,
    plugins: [svelte({ configFile: false })],
    resolve: { alias: { $lib: path.join(root, 'src/lib') } },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [path.resolve(root, '../..')] } },
    logLevel: 'error',
  });
  let browser;
  try {
    await vite.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + vite.httpServer.address().port);
    await page.getByText('IVA por período fiscal').waitFor();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.getByRole('combobox').selectOption('2026-01');
      assert.match(await page.locator('dl').innerText(), /Crédito estimado/);
      assert.match(await page.locator('dl').innerText(), /207,00/);
      await page.getByRole('combobox').selectOption('2025-12');
      assert.match(await page.locator('dl').innerText(), /Saldo estimado a entregar/);
      assert.match((await page.locator('dl').innerText()).replaceAll(/\s/g, ''), /1121,95/);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await vite.close();
  }
  // Retain isolated generated fixtures; no automatic worktree cleanup.
});
