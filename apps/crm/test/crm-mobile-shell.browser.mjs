import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium, expect, webkit } from '@playwright/test';
import { createServer as createVite } from 'vite';

const crm = fileURLToPath(new URL('../', import.meta.url));
const useWebKit = process.argv.includes('--webkit');
const vehicleId = 'c000000000000000000000001';
const draftId = 'c000000000000000000000002';
const fixtureToken = 'local-crm-fixture-token';
const vehicle = {
  id: vehicleId,
  brand: 'BMW',
  model: 'Série 3 Touring xDrive M Sport Performance Edition Longa',
  year: 2022,
  fuel: 'DIESEL',
  mileage: 84250,
  vin: 'WBA12345678901234',
  licensePlate: 'AA-01-AA',
  purchasePrice: '18000.00',
  salePrice: '23500.00',
  status: 'AVAILABLE',
  acquisitionDate: '2025-04-02',
  webPublished: true,
  publicSlug: 'bmw-touring-aaaaaaaaaaaa',
  publicDescription: 'Descrição pública de teste.',
  description: 'Notas internas de teste.',
  publicPrice: null,
  publicTransmission: null,
  publicSpecifications: { powerHp: 190, engineCc: 1995, doors: 5, seats: 5, equipment: [] },
  pendingDocFlags: { docs: false, financing: false, imt: false, registration: false },
  updatedAt: '2026-02-01T00:00:00.000Z',
  createdAt: '2025-04-02T00:00:00.000Z',
  photos: [],
  sale: null,
  expenses: [],
  expensesTotal: '0',
  figures: { margin: '5500', vatAmount: '1028.46', realProfit: '4471.54', commission: '0' },
};
let vite, backend, browser, origin, created;
const writes = [];
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const close = async (server) => {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
};
const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
};

before(async () => {
  backend = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const reply = (value, status = 200) =>
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
    if (req.headers.authorization !== 'Bearer ' + fixtureToken)
      return reply({ error: 'Fixture auth required' }, 401);
    if (url.pathname === '/api/me')
      return reply({
        user: {
          id: 'fixture',
          clerkId: 'fixture',
          email: 'test@example.test',
          name: 'Operador',
          role: 'ADMIN',
        },
      });
    if (url.pathname === '/api/vehicles/stats') return reply({ total: 25, active: 25 });
    if (url.pathname === '/api/tasks/stats') return reply({ mineActive: 0 });
    if (url.pathname === '/api/notifications')
      return reply({
        total: 1,
        alerts: { stockAged: 1, tasksDueOrOverdue: 0, remindersToday: 0, draftVehicles: 0 },
        contacts: { unread: 0, items: [] },
        recent: [],
      });
    if (url.pathname === '/api/search')
      return reply({
        vehicles: [
          {
            id: vehicleId,
            primary: vehicle.brand + ' ' + vehicle.model,
            secondary: vehicle.licensePlate,
            href: '/viaturas/' + vehicleId,
          },
        ],
        customers: [],
        tasks: [],
        total: 1,
      });
    if (url.pathname === '/api/homepage-highlights/showcase')
      return reply({ items: [{ id: vehicleId }] });
    if (url.pathname.endsWith('/photos/signed')) return reply({ photos: [] });
    if (url.pathname === '/api/vehicles/' + vehicleId) return reply(vehicle);
    if (url.pathname === '/api/vehicles/' + draftId)
      return reply(created ?? { ...vehicle, id: draftId, status: 'DRAFT' });
    if (url.pathname === '/api/vehicles/' + vehicleId + '/edit' && req.method === 'PUT') {
      const body = await readBody(req);
      writes.push(body);
      return reply({ ok: true });
    }
    if (url.pathname === '/api/vehicles' && req.method === 'POST') {
      const body = await readBody(req);
      created = { ...vehicle, ...body, id: draftId, webPublished: false, publicSlug: null };
      return reply({ id: draftId }, 201);
    }
    if (url.pathname === '/api/vehicles') {
      const items =
        url.searchParams.get('status') === 'DRAFT'
          ? [{ ...vehicle, id: draftId, status: 'DRAFT', webPublished: false, publicSlug: null }]
          : Array.from({ length: 25 }, (_, i) => ({
              ...vehicle,
              id: 'c' + String(i + 1).padStart(24, '0'),
            }));
      return reply({ items, page: 1, total: items.length, pageSize: 25, totalPages: 1 });
    }
    return reply({ items: [], total: 0 });
  });
  await listen(backend);
  const reserve = createServer();
  await listen(reserve);
  const port = reserve.address().port;
  await close(reserve);
  origin = 'http://127.0.0.1:' + port;
  process.env.PUBLIC_BACKEND_URL = process.env.INTERNAL_BACKEND_URL =
    'http://127.0.0.1:' + backend.address().port;
  process.env.PUBLIC_WEBSITE_URL = 'https://website.fixture';
  process.env.CRM_BASE_PATH = '';

  const root = path.join(crm, '.svelte-kit');
  await mkdir(root, { recursive: true });
  const mock = await mkdtemp(path.join(root, 'route-auth-fixture-'));
  const write = (name, content) => writeFile(path.join(mock, name), content);
  await Promise.all([
    write(
      'server.js',
      `
      export const withClerkHandler = () => ({ event, resolve }) => {
        event.locals.auth = () => ({
          userId: event.cookies.get('crm-fixture') === 'signed-in' ? 'fixture' : null,
          getToken: async () => '${fixtureToken}',
        });
        return resolve(event);
      };
      export const buildClerkProps = () => ({});
    `,
    ),
    write(
      'client.js',
      `
      export { default as ClerkProvider, default as ClerkLoading, default as SignOutButton, default as SignIn } from './Pass.svelte';
      export const useClerkContext = () => ({
        isLoaded: true,
        user: { id: 'fixture', firstName: 'Operador' },
        session: { id: 'fixture-session', getToken: async () => {
          if (window.crmFixtureDelayedToken) await new Promise((resolve) => setTimeout(resolve, 400));
          return '${fixtureToken}';
        } },
      });
    `,
    ),
    write('Pass.svelte', '<script>let { children } = $props();</script>{@render children?.()}'),
  ]);
  vite = await createVite({
    root: crm,
    cacheDir: path.join(mock, 'vite-cache'),
    optimizeDeps: {
      // Keep the Svelte runtime URL stable when the first client route is loaded.
      noDiscovery: true,
      include: [
        '@clerk/themes',
        'lucide-svelte',
        'svelte-sonner',
        'svelte/internal/client',
        'htmlparser2',
        'zod',
      ],
    },
    resolve: {
      dedupe: ['svelte'],
      alias: [
        { find: /^svelte-clerk\/server$/, replacement: path.join(mock, 'server.js') },
        { find: /^svelte-clerk$/, replacement: path.join(mock, 'client.js') },
      ],
    },
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
    logLevel: 'error',
  });
  await vite.listen();
  browser = useWebKit ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
});

after(async () => {
  await browser?.close();
  await vite?.close();
  await close(backend);
});

async function openSession(width, reducedMotion = 'no-preference') {
  const context = await browser.newContext({
    viewport: { width, height: 740 },
    isMobile: width < 768,
    hasTouch: width < 768,
    reducedMotion,
  });
  await context.addCookies([{ name: 'crm-fixture', value: 'signed-in', url: origin }]);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  context.on('page', (page) => {
    page.on('pageerror', (error) => console.error(error));
  });
  return context;
}

async function scrollGesture(page, direction) {
  if (useWebKit) {
    // Playwright cannot inject scrolling touch gestures in mobile WebKit.
    await page.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'instant' }), direction * 380);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const type = (name, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: name,
      touchPoints: name === 'touchEnd' ? [] : [{ x: 190, y }],
    });
  const start = direction > 0 ? 615 : 280;
  await type('touchStart', start);
  for (let step = 1; step <= 8; step++) {
    await type('touchMove', start - direction * step * 41);
    await new Promise((resolve) => setTimeout(resolve, 28));
  }
  await new Promise((resolve) => setTimeout(resolve, 80));
  await type('touchEnd');
  await cdp.detach();
}

async function searchFlow(page) {
  const topbar = page.locator('.topbar');
  await expect(topbar.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1', {
    timeout: 30000,
  });
  const toggle = topbar.getByRole('button', { name: 'Pesquisar', exact: true });
  const closeSearch = topbar.getByRole('button', { name: 'Fechar pesquisa' });
  const layer = topbar.locator('.tb-search-expanded');
  const input = layer.getByRole('combobox', { name: 'Pesquisar' });
  await expect(layer).toHaveCSS('opacity', '0');
  const before = await page.evaluate(() => scrollY);
  await topbar.evaluate((node) => {
    window.searchFrames = [];
    const observer = new MutationObserver(() => {
      if (!node.classList.contains('searching')) return;
      observer.disconnect();
      const layer = node.querySelector('.tb-search-expanded');
      const start = performance.now();
      const record = (now) => {
        const close = layer.querySelector('button[aria-label="Fechar pesquisa"]');
        const box = close.getBoundingClientRect();
        window.searchFrames.push({
          opacity: Number(getComputedStyle(layer).opacity),
          x: box.x,
          y: box.y,
        });
        if (now - start < 260) requestAnimationFrame(record);
      };
      requestAnimationFrame(record);
    });
    observer.observe(node, { attributes: true, attributeFilter: ['class'] });
  });
  await toggle.tap();
  await expect(input).toBeFocused();
  await expect(closeSearch).toBeInViewport();
  await input.fill('BMW');
  await expect(topbar.getByRole('option', { name: /BMW Série 3/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.searchFrames.at(-1)?.opacity)).toBe(1);
  const searchMotion = await page.evaluate(() => ({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    frames: window.searchFrames,
  }));
  assert.equal(
    searchMotion.frames.some((frame) => frame.opacity > 0.05 && frame.opacity < 0.95),
    !searchMotion.reduced,
  );
  assert.ok(
    searchMotion.frames.every(
      ({ x, y }) =>
        Math.abs(x - searchMotion.frames[0].x) < 1 && Math.abs(y - searchMotion.frames[0].y) < 1,
    ),
  );
  await expect(page.getByRole('dialog', { name: 'Tarefas rápidas' })).toHaveCount(0);
  await closeSearch.tap();
  await expect(toggle).toBeFocused();
  await expect(layer).toHaveAttribute('inert', '');
  await expect(layer).toHaveCSS('opacity', '0');
  await expect
    .poll(() => page.evaluate((start) => Math.abs(scrollY - start), before))
    .toBeLessThan(3);
  await toggle.tap();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
}

async function drawerSwipe(locator, fromX, toX) {
  return locator.evaluate(
    (target, [from, to]) => {
      const root = document.documentElement;
      function dispatch(type, x) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', {
          value: type === 'touchend' ? [] : [{ clientX: x, clientY: 140 }],
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      }
      dispatch('touchstart', from);
      const prevented = dispatch('touchmove', to);
      const dragging = root.classList.contains('drawer-dragging');
      dispatch('touchend', to);
      return { prevented, dragging };
    },
    [fromX, toX],
  );
}

async function checkHistoryReturn(page, previousScroll) {
  await page.evaluate(() => {
    const realNow = Date.now;
    Date.now = () => realNow() + 46000;
    window.crmFixtureDelayedToken = true;
    const go = history.go.bind(history);
    window.crmBack = { calls: [], paths: [], frames: [] };
    history.go = (delta) => {
      window.crmBack.calls.push(delta);
      return go(delta);
    };
    window.addEventListener('popstate', () => window.crmBack.paths.push(location.pathname));
    const deadline = performance.now() + 1500;
    const record = () => {
      window.crmBack.frames.push({
        content: Boolean(document.querySelector('main h1')?.textContent.trim()),
        drawer: document.documentElement.classList.contains('drawer-open'),
      });
      if (performance.now() < deadline) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
  });
  assert.deepEqual(await drawerSwipe(page.locator('main'), 5, 145), {
    prevented: false,
    dragging: false,
  });
  await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).toHaveCount(0);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/viaturas$/);
  await expect(page.getByText('25 no inventário')).toBeVisible();
  await expect
    .poll(() => page.evaluate((y) => Math.abs(scrollY - y), previousScroll))
    .toBeLessThanOrEqual(2);
  await expect.poll(() => page.evaluate(() => window.crmBack.frames.length)).toBeGreaterThan(20);
  const { calls, paths, frames } = await page.evaluate(() => window.crmBack);
  assert.deepEqual(calls, []);
  assert.deepEqual(paths, ['/viaturas']);
  assert.ok(frames.every(({ content, drawer }) => content && !drawer));
}

for (const [width, reduced] of [
  [390, false],
  [320, true],
]) {
  test(`real CRM list and detail routes at ${width}px`, { timeout: 180000 }, async () => {
    const context = await openSession(width, reduced ? 'reduce' : 'no-preference');
    try {
      const page = await context.newPage();
      await page.goto(origin + '/viaturas', { waitUntil: 'commit', timeout: 60000 });
      await expect(page.getByText('25 no inventário')).toBeVisible({ timeout: 60000 });
      await searchFlow(page);
      const header = page.locator('.topbar');
      const hamburger = header.getByRole('button', { name: 'Abrir menu' });
      if (useWebKit) await page.waitForTimeout(240);
      for (let i = 0; i < 4; i++) await scrollGesture(page, 1);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(800);
      await expect(header).toBeHidden();
      const down = await page.evaluate(() => scrollY);
      await scrollGesture(page, -1);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(down - 50);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
      await expect(hamburger).toBeInViewport();
      await hamburger.tap();
      await expect(page.getByRole('button', { name: 'Fechar menu', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(hamburger).toBeInViewport();
      await hamburger.tap();
      const sidebar = page.locator('.sidebar');
      const backdrop = page.getByRole('button', { name: 'Fechar menu', exact: true });
      await expect(backdrop).toBeVisible();
      if (reduced) await expect(backdrop).toHaveCSS('animation-name', 'none');
      assert.deepEqual(await drawerSwipe(sidebar, 5, 145), { prevented: false, dragging: false });
      await expect(backdrop).toBeVisible();
      assert.deepEqual(await drawerSwipe(sidebar, 182, 55), { prevented: true, dragging: true });
      await expect(backdrop).toHaveCount(0);
      await searchFlow(page);

      const bell = header.getByRole('button', { name: 'Alertas', exact: true });
      const alerts = page.getByRole('dialog', { name: 'Alertas', exact: true });
      await page.evaluate(() => {
        window.alertFrames = [];
        const record = (now) => {
          const panel = document.querySelector('.alerts-panel');
          if (panel) window.alertFrames.push(Number(getComputedStyle(panel).opacity));
          if (window.alertFrames.length < 40) requestAnimationFrame(record);
        };
        requestAnimationFrame(record);
      });
      await bell.tap();
      await expect(alerts).toBeInViewport();
      await expect(alerts.getByRole('link', { name: /1 viatura em stock/ })).toBeVisible();
      await expect(alerts).toHaveCSS('opacity', '1');
      const opacities = await page.evaluate(() => window.alertFrames);
      assert.equal(
        opacities.some((value) => value > 0.03 && value < 0.97),
        !reduced,
      );
      await alerts.getByRole('button', { name: 'Fechar alertas' }).tap();
      await expect(bell).toBeFocused();
      await expect(alerts).toHaveCount(0);
      await header.getByRole('button', { name: 'Pesquisar', exact: true }).tap();
      await page.getByRole('button', { name: 'Nova tarefa rápida' }).tap();
      await expect(page.getByRole('dialog', { name: 'Tarefas rápidas' })).toBeInViewport();
      await expect(header.locator('.tb-search-expanded')).toHaveAttribute('inert', '');
      await page.keyboard.press('Escape');

      const detailLink = page.locator(`article .row-link[href="/viaturas/${vehicleId}"]`).first();
      await detailLink.evaluate((link) =>
        link.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      const previousScroll = await page.evaluate(() => scrollY);
      assert.ok(previousScroll > 0, 'exercise restoration of a scrolled history entry');
      await detailLink.tap();
      await expect(
        page.getByRole('heading', { name: vehicle.brand + ' ' + vehicle.model }),
      ).toBeVisible();
      for (const [label, href] of [
        ['Vender viatura', '/viaturas/' + vehicleId + '/vender'],
        ['Ver destaque', '/site/destaques?viatura=' + vehicleId],
        ['Editar', '/viaturas/' + vehicleId + '/editar'],
        ['Ver ficha pública', 'https://website.fixture/viaturas/' + vehicle.publicSlug],
      ]) {
        const link = page
          .locator('.vehicle-actions')
          .getByRole('link', { name: label, exact: true });
        await expect
          .poll(() => link.evaluate((anchor) => anchor.href))
          .toBe(new URL(href, origin).href);
        const box = await link.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.height >= 44);
      }
      await expect(page.getByRole('heading', { name: 'Fotografias', exact: true })).toBeVisible();
      await searchFlow(page);
      await checkHistoryReturn(page, previousScroll);
    } finally {
      await context.close();
    }
  });
}

test('real CRM create, draft and edit numeric forms', { timeout: 120000 }, async () => {
  const context = await openSession(1366);
  try {
    const page = await context.newPage();
    await page.goto(origin + '/viaturas', { waitUntil: 'commit', timeout: 60000 });
    await expect(page.getByText('25 no inventário')).toBeVisible({ timeout: 60000 });
    await page.getByRole('link', { name: 'Adicionar Viatura', exact: true }).last().click();
    await expect(page).toHaveURL(/\/viaturas\/nova$/);
    const mileage = page.locator('input[name="mileage"]');
    await expect(mileage).toHaveAttribute('type', 'text', { timeout: 30000 });
    await expect(mileage).toHaveAttribute('inputmode', 'numeric');
    await expect(page.locator('input[type="number"]')).toHaveCount(0);
    await mileage.fill('120500');
    await mileage.press('ArrowUp');
    await mileage.press('ArrowDown');
    await mileage.hover();
    await page.mouse.wheel(0, 100);
    await expect(mileage).toHaveValue('120500');
    const engine = page.locator('input[name="engineCc"]');
    const doors = page.locator('input[name="doors"]');
    await expect(page.locator('label').filter({ has: engine })).toContainText('cm³');
    assert.ok(Math.abs((await engine.boundingBox()).y - (await doors.boundingBox()).y) < 1);
    await engine.fill('1995');
    await doors.fill('9');
    assert.equal(await doors.evaluate((input) => input.validity.valid), false);
    await doors.fill('5');
    const brand = page.getByRole('combobox', { name: 'Marca', exact: true });
    await brand.fill('BMW');
    await page.getByRole('option', { name: 'BMW', exact: true }).click();
    await page.locator('input[name="model"]').fill('Touring de teste');
    await page.locator('input[name="year"]').fill('2022');
    await page.locator('select[name="fuel"]').selectOption('DIESEL');
    await page.locator('input[name="acquisitionDate"]').fill('2025-04-02');
    await page.locator('input[name="licensePlate"]').fill('AA-05-AA');
    await page.locator('input[name="purchasePrice"]').fill('18000,25');
    await page.locator('input[name="salePrice"]').fill('23000,50');
    await mileage.fill('2000001');
    await mileage.press('Enter');
    await expect(page.getByText('O máximo é 2000000.').first()).toBeVisible();
    assert.equal(created, undefined);
    await mileage.fill('');
    await mileage.press('Enter');
    await expect(page).toHaveURL(new RegExp('viatura=' + draftId));
    assert.equal(created.purchasePrice, '18000.25');
    assert.equal(created.salePrice, '23000.50');
    assert.equal(created.mileage ?? null, null);
    assert.equal(created.publicSpecifications.engineCc, 1995);
    await expect(page.locator('input[type="number"]')).toHaveCount(0);

    await page.goto(origin + '/viaturas/' + vehicleId);
    await expect(
      page.locator('.topbar').getByRole('button', { name: 'Alertas', exact: true }),
    ).toContainText('1', { timeout: 30000 });
    const editLink = page
      .locator('.vehicle-actions')
      .getByRole('link', { name: 'Editar', exact: true });
    if (useWebKit) await page.goto(await editLink.evaluate((anchor) => anchor.href));
    else await editLink.click();
    await expect(page).toHaveURL(/\/editar$/);
    await expect(
      page.locator('.topbar').getByRole('button', { name: 'Alertas', exact: true }),
    ).toContainText('1', { timeout: 30000 });
    await expect(mileage).toHaveValue('84250');
    await expect(mileage).toHaveAttribute('type', 'text');
    await mileage.fill('90000');
    if (!useWebKit) {
      // This edit was opened through the client router, so Back reaches the form guard.
      await page.evaluate(() => history.back());
      await expect(page.getByRole('heading', { name: 'Sair desta página?' })).toBeVisible();
      await page.getByRole('button', { name: 'Ficar na página' }).click();
      await expect(page).toHaveURL(/\/editar$/);
      await expect(mileage).toHaveValue('90000');
    }
    await expect(
      page
        .locator('#vehicle-edit-actions')
        .getByRole('button', { name: 'Guardar alterações', exact: true }),
    ).toBeEnabled();
    await mileage.press('Enter');
    const warning = page.getByRole('button', { name: 'Confirmar e guardar alterações' });
    const errors = page.locator('.edit-errors');
    await expect
      .poll(async () => writes.length + Number(await warning.isVisible()) + (await errors.count()))
      .toBeGreaterThan(0);
    assert.equal(await errors.count(), 0, await errors.allTextContents());
    if (await warning.isVisible()) await warning.click();
    await expect.poll(() => writes.length).toBe(1);
    assert.equal(Number(writes[0].data.mileage), 90000);
  } finally {
    await context.close();
  }
});
