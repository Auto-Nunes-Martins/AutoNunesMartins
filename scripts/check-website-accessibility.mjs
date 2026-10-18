// Build apps/website first. Fixture API only; never contacts production/Supabase.
// npm install --prefix .cache/a11y --no-save --ignore-scripts --package-lock=false axe-core@4.10.3
// PowerShell: $env:PLAYWRIGHT_CHANNEL='chrome'; node scripts/check-website-accessibility.mjs
// AXE_CORE_PATH can point to another local axe.min.js installation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const items = Array.from({ length: 5 }, (_, i) => ({
  brand: 'Teste', model: `Modelo ${i + 1}`, slug: `modelo-${i + 1}-abcdef123456`,
  year: 2020 + i, fuel: 'DIESEL', mileage: 20000, price: '21000.00', currency: 'EUR',
  description: null, transmission: null, availability: 'AVAILABLE',
  photos: [`/api/public/vehicles/modelo-${i + 1}-abcdef123456/photos/0`],
}));
const catalog = {
  items, total: items.length, page: 1, pageSize: 30, totalPages: 1,
  facets: { brands: [{ value: 'Teste', count: 5 }], models: [], fuels: [], transmissions: [],
    year: { min: 2020, max: 2024 }, mileage: { min: 20000, max: 20000 },
    price: { min: '21000.00', max: '21000.00' } },
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const listen = async server => {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port;
};
const api = createServer((req, res) => {
  const path = new URL(req.url, 'http://fixture').pathname.replace('/api/public/vehicles', '');
  if (path.includes('/photos/')) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(png); return; }
  const data = path === '/selection' ? {items:new URL(req.url,'http://fixture').searchParams.getAll('id').map(id=>({id,status:items.some(v=>v.slug===id)?200:404,vehicle:items.find(v=>v.slug===id)??null}))} : path === '/brands' ? catalog.facets.brands
    : path === '/homepage-highlights' ? { configured: true, items: items.map(vehicle => ({ vehicle, photoIndex: 0 })) }
    : path.endsWith('/related') ? items.filter(v => !path.includes(v.slug)) : items.find(v => path === `/${v.slug}`) ?? catalog;
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(data));
});
let child, browser;
const summaries = [];
try {
  const backendPort = await listen(api);
  const probe = createServer(); const port = await listen(probe);
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['build/index.js'], { cwd: 'apps/website', stdio: 'pipe', env: {
    ...process.env, PORT: String(port), HOST: '127.0.0.1', ORIGIN: origin,
    INTERNAL_BACKEND_URL: `http://127.0.0.1:${backendPort}`, SITE_NOINDEX: 'true',
  } });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await fetch(origin); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert(ready, 'fixture website starts');
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
  await page.route('https://images.unsplash.com/**', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const axePath = resolve(process.env.AXE_CORE_PATH ?? '.cache/a11y/node_modules/axe-core/axe.min.js');
  const audit = async label => {
    await page.addScriptTag({ path: axePath });
    const report = await page.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, rules: { 'color-contrast': { enabled: false }, 'label-content-name-mismatch': { enabled: true } } });
      const details = v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary, checks: [...n.any, ...n.all, ...n.none].map(c => ({ message: c.message, data: c.data })) })) });
      return { violations: result.violations.map(details), incomplete: result.incomplete.map(details) };
    });
    summaries.push({ label, ...report });
    console.log(`${report.violations.length ? 'FAIL' : 'PASS'} axe ${label}`, JSON.stringify(report.violations));
  };
  const visit = async path => {
    await page.goto(origin + path);
    await page.locator('.stand-header').waitFor();
    // Wait for the client stores, rather than measuring the SSR disabled state.
    await page.waitForFunction(() => !document.querySelector('button[aria-pressed][disabled]'));
  };
  for (const path of ['/', '/viaturas', `/viaturas/${items[0].slug}`, '/quem-somos', '/favoritos', '/comparar', '/informacao-legal', '/politica-de-privacidade', '/pagina-inexistente']) {
    await visit(path); await audit(path);
  }
  await visit('/');
  await page.screenshot({ path: '.cache/a11y-desktop.png' });
  const featured = page.locator('a#orbit-featured');
  const caption = await featured.locator('#featured-vehicle-caption').innerText();
  assert.equal((await featured.ariaSnapshot()).split('\n')[0].toLowerCase().includes(caption.replace(/\s+/g, ' ').trim().toLowerCase()), true);
  await page.getByRole('button', { name: 'Destaque seguinte', exact: true }).click();
  assert.notEqual(await featured.locator('#featured-vehicle-caption').innerText(), caption);
  await audit('hero avançado');
  const cabin = page.locator('.cabin-tabs').getByRole('button', { name: '02 O seu espaço', exact: true });
  await cabin.focus(); await page.keyboard.press('Enter');
  assert.equal(await cabin.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#cabin-description').getAttribute('role'), 'status');
  await audit('habitáculo selecionado');
  assert.equal(await page.locator('[aria-hidden="true"] button:not([tabindex="-1"])').count(), 0, 'hidden review copies cannot receive Tab focus');
  const contact = page.getByRole('button', { name: 'Vamos conhecer-nos', exact: true });
  await contact.focus(); await page.keyboard.press('Enter');
  const contactDialog = page.getByRole('dialog', { name: 'O que tem em mente?', exact: true });
  assert.equal(await contactDialog.count(), 1);
  await audit('contacto aberto');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await contactDialog.evaluate(el => el.contains(document.activeElement)), true);
  }
  await page.keyboard.press('Escape');
  assert.equal(await contact.evaluate(el => el === document.activeElement), true);
  await visit(`/viaturas/${items[0].slug}`);
  const related = page.locator('.carousel .viewport');
  await related.focus();
  const firstRelated = await related.locator('[data-vehicle]').first().getAttribute('data-vehicle');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(first => document.querySelector('.carousel [data-vehicle]')?.getAttribute('data-vehicle') !== first, firstRelated);
  await related.focus();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.ghost')), false);
    const visibleFocus = await related.evaluate(viewport => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.closest('[data-vehicle]')) return true;
      const focus = el.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
      return focus.right > bounds.left && focus.left < bounds.right;
    });
    assert.equal(visibleFocus, true, 'offscreen related cards reveal when focused');
  }
  const compare = page.getByRole('button', { name: 'Comparar: Teste Modelo 1', exact: true });
  await compare.focus(); await page.keyboard.press('Enter');
  const selected = page.getByRole('button', { name: 'Na comparação: Teste Modelo 1 — remover da comparação', exact: true });
  assert.equal(await selected.getAttribute('aria-pressed'), 'true');
  assert.equal(await selected.evaluate(el => el === document.activeElement), true);
  assert.equal(await page.getByRole('link', { name: 'Comparar 1', exact: true }).count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Guardar: Teste Modelo 1 nos favoritos', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Guardada: Teste Modelo 1 — remover dos favoritos', exact: true }).getAttribute('aria-pressed'), 'true');
  await audit('viatura selecionada e avisos');
  await page.locator('.vehicle-photo').click();
  assert.equal(await page.getByRole('dialog', { name: 'Teste Modelo 1 · 1 / 1', exact: true }).count(), 1);
  await audit('galeria aberta');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.vehicle-photo').evaluate(el => el === document.activeElement), true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of ['/favoritos', '/comparar', '/viaturas?brand=Teste']) { await visit(path); await audit(path + ' preenchido'); }
  const combobox = page.getByRole('combobox').first();
  await combobox.focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await combobox.getAttribute('aria-expanded'), 'true');
  // axe 4.10 asks for manual review for every aria-controls + aria-haspopup.
  // Verify that relationship against the rendered popup explicitly.
  const popupId = await combobox.getAttribute('aria-controls');
  const popup = page.locator(`[id="${popupId}"]`);
  assert.equal(await popup.getAttribute('role'), 'listbox');
  assert.equal(await popup.isVisible(), true);
  const activeId = await combobox.getAttribute('aria-activedescendant');
  assert.equal(await page.locator(`[id="${activeId}"]`).getAttribute('role'), 'option');
  await audit('filtro aberto');
  await page.keyboard.press('Escape');
  assert.equal(await combobox.getAttribute('aria-expanded'), 'false');
  assert.equal(await combobox.getAttribute('aria-controls'), null);
  assert.equal(await combobox.evaluate(el => el === document.activeElement), true);
  await visit('/favoritos');
  const removeFavorite = page.getByRole('button', { name: 'Remover Teste Modelo 1 dos favoritos', exact: true });
  await removeFavorite.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('main h1').evaluate(el => el === document.activeElement), true);
  await audit('favorito removido pelo teclado');
  await page.setViewportSize({ width: 390, height: 844 });
  await visit('/');
  await page.screenshot({ path: '.cache/a11y-mobile.png' });
  await audit('início móvel');
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  await menu.focus(); await page.keyboard.press('Enter');
  const closeMenu = page.getByRole('button', { name: 'Fechar menu', exact: true });
  assert.equal(await closeMenu.getAttribute('aria-expanded'), 'true');
  await audit('menu móvel aberto');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('#stand-navigation').evaluate(el => el.inert), true);
  for (const path of ['/viaturas', `/viaturas/${items[0].slug}`, '/quem-somos', '/favoritos', '/comparar', '/informacao-legal', '/politica-de-privacidade']) { await visit(path); await audit(path + ' móvel'); }
  assert.deepEqual(errors, [], 'no browser runtime errors');
  const axeVersion = await page.evaluate(() => window.axe.version);
  await writeFile('.cache/website-accessibility-report.json', JSON.stringify({ axeVersion, contrastExcluded: true, popupRelationshipVerified: true, summaries }, null, 2));
  assert.deepEqual(summaries.filter(r => r.violations.length), [], 'no automated naming/semantics violations (contrast excluded)');
  console.log('PASS keyboard, state, accessible names and dialog focus; incomplete axe checks:', [...new Set(summaries.flatMap(r => r.incomplete.map(v => v.id)))]);
} finally {
  await browser?.close(); child?.kill(); await new Promise(resolve => api.close(resolve));
}
