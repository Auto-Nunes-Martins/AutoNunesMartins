import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium, expect, webkit } from '@playwright/test';
import { createServer as createVite } from 'vite';

const crm = fileURLToPath(new URL('../', import.meta.url));
const useWebKit = process.argv.includes('--webkit') || process.env.CRM_TEST_BROWSER === 'webkit';
const vehicleId = 'c000000000000000000000001';
const campaignCars = [
  [vehicleId, 'BMW', 'Série 3 Touring', '23900.00'],
  ['c000000000000000000000011', 'MINI', 'Countryman Cooper D', '21400.00'],
  ['c000000000000000000000012', 'Audi', 'A3 Sportback', '22900.00'],
  ['c000000000000000000000013', 'Peugeot', '308 SW', '19500.00'],
  ['c000000000000000000000014', 'Volvo', 'XC40', '29500.00'],
];
const draftId = 'c000000000000000000000002';
const galleryId = 'c000000000000000000000097';
const singlePhotoId = 'c000000000000000000000098';
const fullStripId = 'c000000000000000000000099';
const photoCounts = new Map([
  [galleryId, 3],
  [singlePhotoId, 1],
  [fullStripId, 16],
]);
const photosFor = (id) =>
  Array.from({ length: photoCounts.get(id) ?? 0 }, (_, index) => ({
    path: `${id}/00000000-0000-4000-8000-00000000000${index}.webp`,
    url: '/fixture-vehicle.svg?photo=' + index,
    width: 96,
    height: 72,
  }));
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
let campaignFixture = { revision: null, items: [] };
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
    const photoIndex = campaignCars.findIndex(
      ([id]) => url.pathname === '/api/homepage-highlights/photos/' + id,
    );
    if (photoIndex >= 0)
      return reply({
        photos: [
          { url: '/fixture-campaign.webp?photo=' + (photoIndex % 2), width: 960, height: 540 },
        ],
      });
    if (url.pathname === '/api/vehicle-campaigns') {
      if (req.method === 'PUT') {
        const input = await readBody(req);
        if (input.revision !== campaignFixture.revision)
          return reply({ error: 'Revisão desatualizada' }, 409);
        const now = Date.now();
        campaignFixture = {
          revision: String(now),
          items: input.items.map((item) => ({
            ...item,
            referencePrice: '23500.00',
            startsAt: new Date(now).toISOString(),
            endsAt: new Date(now + item.durationDays * 86_400_000).toISOString(),
          })),
        };
        return reply({ revision: campaignFixture.revision });
      }
      return reply({
        ...campaignFixture,
        candidates: campaignCars.map(([id, brand, model, price], index) => ({
          id,
          brand,
          model,
          price,
          year: 2021,
          licensePlate: 'AA-0' + index + '-AA',
          referencePrice: index === 0 ? '23500.00' : null,
        })),
      });
    }
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
    if (url.pathname.endsWith('/photos/signed')) {
      return reply({ photos: photosFor(url.pathname.split('/')[3]) });
    }
    if (url.pathname === '/api/vehicles/' + vehicleId) return reply(vehicle);
    if (
      url.pathname === '/api/vehicles/' + galleryId ||
      url.pathname === '/api/vehicles/' + singlePhotoId ||
      url.pathname === '/api/vehicles/' + fullStripId
    ) {
      const id = url.pathname.split('/').at(-1);
      const photos = photosFor(id).map(({ path }) => path);
      if (id === galleryId) {
        return reply({
          ...vehicle,
          id,
          photos,
          createdAt: '2026-07-05T23:15:00.000Z',
          updatedAt: '2026-07-06T08:45:00.000Z',
        });
      }
      const times =
        id === fullStripId
          ? { updatedAt: vehicle.createdAt }
          : { createdAt: null, updatedAt: '2026-07-05' };
      return reply({ ...vehicle, id, photos, ...times });
    }
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
              licensePlate: i === 2 || i === 3 ? null : vehicle.licensePlate,
              vin: i === 1 || i === 3 ? null : vehicle.vin,
              thumbnailUrl: i % 2 ? null : '/fixture-vehicle.svg',
              status: i === 2 ? 'RESERVED' : i === 3 ? 'DOCS_PENDING' : 'AVAILABLE',
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
  console.log(`CRM browser fixture: ${browser.browserType().name()}`);
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
  await context.route('**/fixture-vehicle.svg*', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="72"><rect width="96" height="72" fill="#486c7b"/></svg>',
    }),
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

for (const width of [1366, 390]) {
  test(
    `real CRM campaign editor saves and ends a promotion at ${width}px`,
    { timeout: 90000 },
    async () => {
      const context = await openSession(width, width < 860 ? 'reduce' : 'no-preference');
      try {
        const page = await context.newPage();
        await page.route('**/fixture-campaign.webp*', (route) => {
          const index = new URL(route.request().url()).searchParams.get('photo');
          const photo =
            index === '1' ? 'preparation-demo-v1-960.webp' : 'showroom-demo-v1-960.webp';
          return route.fulfill({
            path: path.resolve(crm, '../website/static/images/about', photo),
          });
        });
        await page.goto(origin + '/site/campanhas', {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        await expect(page.getByRole('link', { name: 'Campanhas' })).toHaveAttribute(
          'aria-current',
          'page',
        );
        const tabs = page.getByRole('navigation', { name: 'Secções do site público' });
        await expect(tabs.getByRole('link')).toHaveText([
          'Destaques da homepage',
          'Campanhas',
          'Reviews',
        ]);
        await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText(
          '1',
          { timeout: 30000 },
        );
        const catalog = page.getByRole('region', { name: 'Catálogo de viaturas' });
        const campaigns = page.getByRole('region', { name: 'Viaturas em campanha' });
        const search = catalog.getByRole('searchbox');
        const add = catalog.getByRole('button', { name: 'Adicionar BMW Série 3 Touring' });
        const save = campaigns.getByRole('button', { name: 'Guardar campanhas' });
        await expect(campaigns.getByText('Nenhuma campanha selecionada.')).toBeVisible();
        await expect(catalog.getByRole('listitem')).toHaveCount(5);
        const panels = await Promise.all([campaigns.boundingBox(), catalog.boundingBox()]);
        assert.ok(panels.every(Boolean));
        assert.ok(width > 860 ? panels[0].x < panels[1].x : panels[0].y < panels[1].y);
        if (width < 860) {
          await page.getByRole('link', { name: 'Ver catálogo' }).click();
          await expect(catalog.getByRole('heading')).toBeFocused();
        }
        await search.fill('serie');
        await expect(catalog.getByRole('listitem')).toHaveCount(1);
        await expect
          .poll(async () =>
            catalog
              .locator('img')
              .evaluateAll((images) =>
                images.some((image) => image.complete && image.naturalWidth > 0),
              ),
          )
          .toBe(true);
        await add.click();
        const card = campaigns.getByRole('article');
        const cardTitle = card.getByRole('heading', { name: 'BMW Série 3 Touring' });
        await expect(cardTitle).toBeFocused();
        await expect(cardTitle).toBeInViewport();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(
          catalog.getByRole('button', { name: 'BMW Série 3 Touring adicionada' }),
        ).toBeDisabled();
        await expect(card.locator('img')).toBeVisible();
        const price = card.getByLabel('Preço promocional (€)', { exact: true });
        const discount = card.getByLabel('Desconto (%)', { exact: true });
        await price.fill('24000,00');
        await save.click();
        await expect(card.getByRole('alert')).toContainText('inferior');
        await price.fill('21900,00');
        await expect(discount).toHaveValue('7');
        await discount.fill('10');
        await expect(price).toHaveValue('21150.00');
        await card.getByLabel('Duração (dias)').fill('9');
        const submission = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' && response.url().endsWith('/site/campanhas'),
        );
        await save.click();
        const result = await (await submission).json();
        assert.equal(result.type, 'success', JSON.stringify(result));
        await expect(campaigns.getByText('Campanhas guardadas.', { exact: true })).toBeVisible({
          timeout: 15000,
        });
        assert.equal(campaignFixture.items[0].price, '21150.00');
        assert.equal(campaignFixture.items[0].durationDays, 9);
        await expect(card.getByText('Em campanha')).toBeVisible();
        await search.clear();
        await expect(catalog.getByRole('listitem')).toHaveCount(5);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (process.env.CAMPAIGN_PREVIEW === '1') {
          await catalog.evaluate((node) => node.scrollIntoView({ block: 'center' }));
          await expect
            .poll(() =>
              catalog
                .locator('img')
                .evaluateAll(
                  (images) =>
                    images.filter((image) => image.complete && image.naturalWidth > 0).length,
                ),
            )
            .toBe(campaignCars.length);
          const screenshot = path.join(
            crm,
            '.svelte-kit',
            'campanhas-crm-inline-' + width + '.png',
          );
          await page.locator('.site-workspace').screenshot({
            path: screenshot,
            animations: 'disabled',
            style: '.topbar, .bottom-nav, .qt-bubble { visibility: hidden !important; }',
          });
          console.log(screenshot);
        }
        for (const [, brand, model] of campaignCars.slice(1, 4)) {
          await catalog.getByRole('button', { name: 'Adicionar ' + brand + ' ' + model }).click();
        }
        await expect(catalog.getByText('Limite de quatro viaturas atingido.')).toBeVisible();
        await expect(catalog.getByRole('button', { name: 'Adicionar Volvo XC40' })).toBeDisabled();
        for (const [, brand, model] of campaignCars.slice(0, 4)) {
          await campaigns.getByRole('button', { name: 'Remover ' + brand + ' ' + model }).click();
        }
        await expect(campaigns.getByText('Nenhuma campanha selecionada.')).toBeVisible();
        await expect(add).toBeEnabled();
        assert.equal(campaignFixture.items.length, 1);
        await save.click();
        await expect.poll(() => campaignFixture.items.length).toBe(0);
        await page.reload();
        await expect(page.getByText('Nenhuma campanha selecionada.')).toBeVisible();
      } finally {
        await context.close();
      }
    },
  );
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
        const title = node.querySelector('.tb-page-title');
        const box = close.getBoundingClientRect();
        window.searchFrames.push({
          opacity: Number(getComputedStyle(layer).opacity),
          width: layer.querySelector('.gs-input-shell').getBoundingClientRect().width,
          titleOpacity: Number(getComputedStyle(title).opacity),
          closeOpacity: Number(getComputedStyle(close).opacity),
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
  const fullWidth = await layer.locator('.gs-input-shell').evaluate((shell) => shell.offsetWidth);
  assert.equal(
    searchMotion.frames.some(({ width }) => width > 44 && width < fullWidth - 4),
    !searchMotion.reduced,
  );
  assert.equal(
    searchMotion.frames.some(
      ({ titleOpacity, closeOpacity, width }) =>
        titleOpacity > 0.05 && titleOpacity < 0.95 && width > 44 && closeOpacity < 0.05,
    ),
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
  await toggle.tap();
  await expect(input).toBeFocused();
  const beforeOutside = await page.evaluate(() => scrollY);
  await page.touchscreen.tap(5, 160);
  await expect(layer).toHaveAttribute('inert', '');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toBeFocused();
  await expect
    .poll(() => page.evaluate((previous) => Math.abs(scrollY - previous), beforeOutside))
    .toBeLessThan(1);
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

test(
  'only the hamburger opens the drawer; leftward swipes close it from either zone',
  { timeout: 90000 },
  async () => {
    const context = await openSession(390);
    try {
      const page = await context.newPage();
      await page.goto(origin + '/viaturas');
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1', {
        timeout: 30000,
      });
      const menu = page.getByRole('button', { name: 'Abrir menu' });
      for (const from of [5, 60, 210]) {
        assert.deepEqual(await drawerSwipe(page.locator('main'), from, from + 130), {
          prevented: false,
          dragging: false,
        });
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
      }
      for (const [selector, start, end] of [
        ['.sidebar', 185, 55],
        ['.drawer-backdrop', 345, 140],
      ]) {
        await menu.tap();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
        assert.deepEqual(await drawerSwipe(page.locator(selector), start, end), {
          prevented: true,
          dragging: true,
        });
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
        await expect(page).toHaveURL(origin + '/viaturas');
      }
    } finally {
      await context.close();
    }
  },
);

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

async function checkVehicleRows(page, width) {
  const rows = page.locator('article.linked-row');
  const photo = rows.first().locator('.mobile-vehicle-photo');
  const placeholder = rows.nth(1).locator('.mobile-vehicle-photo');
  await rows.first().scrollIntoViewIfNeeded();
  await expect
    .poll(() => photo.locator('img').evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(placeholder.locator('svg')).toBeVisible();
  const boxes = await Promise.all([photo.boundingBox(), placeholder.boundingBox()]);
  assert.ok(boxes.every((box) => box.width >= 68 && box.height >= 51));
  assert.equal(boxes[0].width, boxes[1].width);
  await expect(
    rows.first().locator('[title="' + vehicle.brand + ' ' + vehicle.model + '"]'),
  ).toHaveCSS('-webkit-line-clamp', '2');
  const menuButton = rows.first().getByRole('button', { name: /Mais opções/ });
  const price = rows.first().locator('[title="PVP"]');
  const [priceBox, rowLinkBox] = await Promise.all([
    price.boundingBox(),
    rows.first().locator('.mobile-vehicle-link').boundingBox(),
  ]);
  assert.ok(Math.abs(priceBox.x + priceBox.width - (rowLinkBox.x + rowLinkBox.width)) < 2);
  const buttonBox = await menuButton.boundingBox();
  assert.ok(
    buttonBox.width >= 44 && buttonBox.height >= 44 && buttonBox.x + buttonBox.width <= width,
  );
  await menuButton.tap();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(rows.first().getByRole('menuitem', { name: 'Editar', exact: true })).toBeVisible();
  const listUrl = page.url();
  const openRowBox = await rows.first().locator('.mobile-vehicle-link').boundingBox();
  assert.ok(openRowBox);
  const outside = { x: openRowBox.x + 5, y: openRowBox.y + openRowBox.height / 2 };
  const dismiss = page.locator('.action-popover:popover-open .action-dismiss');
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.down();
  try {
    await expect(dismiss).toHaveCSS('box-shadow', 'none', { timeout: 1500 });
    await expect(dismiss).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(dismiss).not.toBeFocused();
  } finally {
    await page.mouse.up();
  }
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(listUrl);
  await menuButton.tap();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await page.touchscreen.tap(outside.x, outside.y);
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(listUrl);
  await menuButton.tap();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  const otherTrigger = await page.evaluate(() => {
    const dismiss = document.querySelector('.action-popover:popover-open .action-dismiss');
    return [...document.querySelectorAll('article .more-button')]
      .slice(1)
      .map((button) => {
        const box = button.getBoundingClientRect();
        return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
      })
      .find(
        ({ x, y }) => y > 75 && y < innerHeight - 75 && document.elementFromPoint(x, y) === dismiss,
      );
  });
  assert.ok(otherTrigger);
  await page.touchscreen.tap(otherTrigger.x, otherTrigger.y);
  await expect(page.locator('.action-popover:popover-open')).toHaveCount(0);
  await expect(page).toHaveURL(listUrl);
  await page.touchscreen.tap(otherTrigger.x, otherTrigger.y);
  await expect(page.locator('.action-popover:popover-open')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await menuButton.tap();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  const quickTask = page.getByRole('button', { name: 'Nova tarefa rápida' });
  const taskBox = await quickTask.boundingBox();
  assert.ok(taskBox);
  await page.touchscreen.tap(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('dialog', { name: 'Tarefas rápidas' })).toHaveCount(0);
  await quickTask.tap();
  const quickPanel = page.getByRole('dialog', { name: 'Tarefas rápidas' });
  await expect(quickPanel).toBeVisible();
  await quickPanel.getByRole('button', { name: 'Fechar', exact: true }).tap();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await menuButton.focus();
  await menuButton.press('Enter');
  const firstAction = rows.first().getByRole('menuitem').first();
  await expect(firstAction).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menuButton).toBeFocused();
  for (const index of [0, 2, 3]) {
    const tags = rows.nth(index).locator('.mobile-vehicle-tags .vehicle-state-chip');
    const boxes = await tags.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { top, left, right, height } = node.getBoundingClientRect();
        return {
          center: top + height / 2,
          left,
          right,
          overflows: node.scrollWidth > node.clientWidth + 1,
        };
      }),
    );
    assert.ok(
      boxes.length >= 1 &&
        boxes.every(
          (box) =>
            Math.abs(box.center - boxes[0].center) < 1 &&
            box.left >= 0 &&
            box.right <= width &&
            !box.overflows,
        ),
    );
    if (index === 0) assert.equal(boxes.length, 2);
  }
}

async function photoGesture(surface, dx, dy, x = 155) {
  return surface.evaluate(
    (node, { dx, dy, x }) => {
      const y = node.getBoundingClientRect().top + 60;
      function dispatch(type, offsetX, offsetY) {
        const point = { clientX: x + offsetX, clientY: y + offsetY, identifier: 1 };
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
          touches: { value: type === 'touchend' ? [] : [point] },
          changedTouches: { value: [point] },
        });
        node.dispatchEvent(event);
        return event.defaultPrevented;
      }
      dispatch('touchstart', 0, 0);
      const claimed = dispatch('touchmove', dx / 2, dy / 2);
      dispatch('touchend', dx, dy);
      return claimed;
    },
    { dx, dy, x },
  );
}

test(
  'real CRM photo detail mobile gestures, controls and viewer',
  { timeout: 120000 },
  async () => {
    const context = await openSession(390);
    try {
      const page = await context.newPage();
      await page.goto(origin + '/viaturas/' + galleryId, { waitUntil: 'commit', timeout: 60000 });
      const surface = page.locator('.photo-preview .photo-open');
      await expect(surface).toHaveAccessibleName('Ampliar fotografia 1 de 3', { timeout: 30000 });
      const recordTimes = page.locator('.vehicle-record-times');
      await expect(recordTimes).toBeHidden();
      await expect(page.getByText('Editar fotografias', { exact: true })).toHaveCount(0);
      await expect(page.locator('.photo-preview .photo-step').first()).toBeHidden();
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1', {
        timeout: 30000,
      });
      assert.equal(await photoGesture(surface, 86, 0), true);
      await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await expect(surface).toHaveAccessibleName('Ampliar fotografia 1 de 3');
      assert.equal(await photoGesture(surface, 15, 95), false);
      assert.equal(await photoGesture(surface, 86, 0, 10), false);
      assert.equal(await photoGesture(surface, -88, 3), true);
      await expect(surface).toHaveAccessibleName('Ampliar fotografia 2 de 3');
      await expect(
        page.getByRole('button', { name: 'Selecionar fotografia 2', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Selecionar fotografia 3', exact: true }).tap();
      await expect(surface).toHaveAccessibleName('Ampliar fotografia 3 de 3');
      assert.equal(await photoGesture(surface, -88, 0), true);
      await expect(surface).toHaveAccessibleName('Ampliar fotografia 3 de 3');
      await surface.press('Enter');
      const viewer = page.locator('.crm-photo-viewer');
      const viewerPhoto = viewer.locator('.photo-rail-slide:not([inert]) img');
      const position = viewer.locator('.viewer-photo-position');
      const closeViewer = viewer.getByRole('button', { name: 'Fechar fotografia' });
      const viewerThumbnail = (index) =>
        viewer.getByRole('button', { name: `Ver fotografia ${index}`, exact: true });
      await expect(viewer).toBeVisible();
      await expect(viewer.locator('.viewer-step')).toHaveCount(0);
      await expect(position).toHaveText('3 / 3');
      await expect(viewerThumbnail(3)).toHaveAttribute('aria-pressed', 'true');
      await expect(viewerThumbnail(3).locator('img')).toBeVisible();
      const strip = await viewer.locator('.viewer-thumbnails').boundingBox();
      const stage = await viewer.locator('.viewer-stage').boundingBox();
      assert.ok(strip.y >= stage.y + stage.height && strip.height >= 56);
      assert.equal(await photoGesture(viewerPhoto, 90, 0), true);
      await expect(position).toHaveText('2 / 3');
      await expect(viewerThumbnail(2)).toHaveAttribute('aria-pressed', 'true');
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, 'scale', { configurable: true, value: 2 });
        visualViewport.dispatchEvent(new Event('resize'));
      });
      assert.equal(await photoGesture(viewerPhoto, 90, 0), false);
      await expect(position).toHaveText('2 / 3');
      await page.evaluate(() => {
        delete visualViewport.scale;
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await viewerThumbnail(1).tap();
      await expect(position).toHaveText('1 / 3');
      await expect(viewerThumbnail(1)).toHaveAttribute('aria-pressed', 'true');
      const closeBox = await closeViewer.boundingBox();
      assert.equal(closeBox.width, 48);
      await page.mouse.move(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
      await page.mouse.down();
      try {
        await expect(closeViewer).toHaveCSS('background-color', 'rgb(96, 101, 107)');
      } finally {
        await page.mouse.up();
      }
      await expect(viewer).toBeHidden();
      await expect(surface).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'Selecionar fotografia 1', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await surface.press('Enter');
      await expect(viewerPhoto).toBeVisible();
      await expect
        .poll(() => viewerPhoto.evaluate((image) => image.naturalWidth))
        .toBeGreaterThan(0);
      const frame = await viewerPhoto.boundingBox();
      await page.touchscreen.tap(frame.x + frame.width / 2, frame.y + frame.height / 2);
      await expect(viewer).toBeVisible();
      await page.touchscreen.tap(3, frame.y + frame.height / 2);
      await expect(viewer).toBeHidden();
      await surface.press('Enter');
      await expect(viewerPhoto).toBeVisible();
      assert.equal(await photoGesture(viewerPhoto, 0, 220), true);
      await expect(viewer).toBeHidden();
      await expect(surface).toBeFocused();
      await page.goto(origin + '/viaturas/' + singlePhotoId);
      await expect(surface).toHaveAccessibleName('Ampliar fotografia 1 de 1', { timeout: 30000 });
      await expect(page.locator('.photo-preview .photo-step')).toHaveCount(0);
      assert.equal(await photoGesture(surface, -90, 0), false);
      await surface.press('Enter');
      await expect(position).toHaveText('1 / 1');
      await expect(viewerThumbnail(1)).toHaveAttribute('aria-pressed', 'true');
      await viewer.getByRole('button', { name: 'Fechar fotografia' }).tap();
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(origin + '/viaturas/' + galleryId);
      await expect(recordTimes).toBeVisible();
      await expect(recordTimes.locator('time').first()).toHaveText(/06\/07\/2026.*00:15/);
      await expect(recordTimes.locator('time').last()).toHaveText(/06\/07\/2026.*09:45/);
      await expect(page.getByText('Editar fotografias', { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Fotografia seguinte', exact: true }),
      ).toBeVisible();
      await page.goto(origin + '/viaturas/' + singlePhotoId);
      await expect(recordTimes).toHaveCount(0);
    } finally {
      await context.close();
    }
  },
);

async function captureOpening(page, selector, open, sampleTimes = []) {
  await page.evaluate(
    ({ selector, sampleTimes }) => {
      window.openingAnimations = new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          const panel = document.querySelector(selector);
          if (!panel) return;
          observer.disconnect();
          requestAnimationFrame(() => {
            const animations = panel.getAnimations();
            const durations = animations.map((animation) => animation.effect.getTiming().duration);
            if (!sampleTimes.length) return resolve(durations);
            const [animation] = animations;
            if (!animation) return resolve({ durations, frames: [] });
            const elapsed = animation.currentTime;
            animation.pause();
            const frames = sampleTimes.map((time) => {
              animation.currentTime = time;
              const style = getComputedStyle(panel);
              return {
                opacity: Number(style.opacity),
                y: new DOMMatrixReadOnly(style.transform).m42,
                height: panel.offsetHeight,
                gap:
                  panel.getBoundingClientRect().top -
                  panel.parentElement.querySelector('.gs-input-shell').getBoundingClientRect()
                    .bottom,
              };
            });
            animation.currentTime = elapsed;
            animation.play();
            resolve({ durations, frames });
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
    },
    { selector, sampleTimes },
  );
  await open();
  return page.evaluate(() => window.openingAnimations);
}

function desktopHoverBorder(page) {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-border-strong)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

test(
  'real CRM desktop list alignment and distinct panel animations',
  { timeout: 90000 },
  async () => {
    const context = await openSession(1366);
    try {
      const page = await context.newPage();
      await page.goto(origin + '/viaturas');
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1', {
        timeout: 30000,
      });
      const rows = page.locator('table tbody tr');
      const identifiers = (row) => rows.nth(row).locator('.vehicle-identifiers');
      await expect(identifiers(0)).toHaveText(
        new RegExp(`${vehicle.licensePlate}\\s*·\\s*${vehicle.vin}`),
      );
      await expect(identifiers(1)).toHaveText(vehicle.licensePlate);
      await expect(identifiers(2)).toHaveText(vehicle.vin);
      await expect(identifiers(3)).toHaveCount(0);
      const alignment = await rows.first().evaluate((row) => {
        const name = row.querySelector('.vehicle-name-text').getBoundingClientRect();
        const plate = row.querySelector('.vehicle-plate').getBoundingClientRect();
        const logo = row.querySelector('.vehicle-name img').getBoundingClientRect();
        return {
          difference: Math.abs(name.left - plate.left),
          logoSeparate: logo.right < name.left,
        };
      });
      assert.ok(alignment.difference < 1 && alignment.logoSeparate);
      const rowMenu = rows.first().getByRole('button', { name: /Mais opções/ });
      await rowMenu.evaluate((button) => button.focus({ preventScroll: true }));
      await page.keyboard.press('ArrowDown');
      await expect(rowMenu).toHaveAttribute('aria-expanded', 'true');
      const rowPopover = page.locator('.action-popover:popover-open');
      await expect(rowPopover.getByRole('menuitem').first()).toBeFocused();
      assert.equal(
        await rowPopover.evaluate((node) => getComputedStyle(node, '::backdrop').backgroundColor),
        'rgba(0, 0, 0, 0)',
      );
      await page.mouse.click(8, 8);
      await expect(rowMenu).toHaveAttribute('aria-expanded', 'false');
      const search = page.locator('.tb-search-inline .gs-root');
      const field = search.getByRole('combobox', { name: 'Pesquisar' });
      const dropdown = search.locator('.gs-dropdown');
      const opening = await captureOpening(
        page,
        '.tb-search-inline .gs-dropdown',
        () => field.focus(),
        [0, 30, 90, 180, 240],
      );
      assert.deepEqual(opening.durations, [240]);
      assert.ok(opening.frames[0].y < -5.8 && opening.frames[0].opacity < 0.02);
      assert.ok(Math.abs(opening.frames[0].gap) < 0.1);
      assert.ok(opening.frames[1].y > -5.3 && opening.frames[1].opacity > 0.25);
      assert.ok(opening.frames[2].y > -3.5 && opening.frames[2].opacity > 0.7);
      assert.ok(Math.abs(opening.frames[4].y) < 0.01 && opening.frames[4].opacity === 1);
      assert.ok(Math.abs(opening.frames[4].gap - 6) < 0.1);
      assert.ok(opening.frames.every((frame) => frame.height === opening.frames[0].height));
      await expect(dropdown).toHaveCSS('opacity', '1');
      await field.press('Escape');
      await expect(field).toHaveAttribute('aria-expanded', 'false');
      await expect(field).toBeFocused();
      await expect(dropdown).toHaveCount(0);
      const bell = page.getByRole('button', { name: 'Alertas', exact: true });
      await bell.hover();
      const hoverBorder = await desktopHoverBorder(page);
      await expect(bell).toHaveCSS('border-top-color', hoverBorder);
      assert.deepEqual(await captureOpening(page, '.alerts-panel', () => bell.click()), [220]);
      await page.keyboard.press('Escape');
      await expect(page.locator('.alerts-panel')).toHaveCount(0);
      const quickTask = page.getByRole('button', { name: 'Tarefas rápidas', exact: true });
      await quickTask.hover();
      await expect(quickTask).toHaveCSS('border-top-color', hoverBorder);
      const quickPanel = page.getByRole('dialog', { name: 'Tarefas rápidas' });
      assert.deepEqual(
        await captureOpening(page, '.qt-panel:not(.is-mobile)', () => quickTask.click()),
        [280],
      );
      await expect(quickPanel).toHaveCSS('opacity', '1');
      await quickPanel.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(quickPanel).toHaveCount(0);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.deepEqual(
        await captureOpening(page, '.qt-panel:not(.is-mobile)', () => quickTask.click()),
        [],
      );
      await expect(quickPanel).toHaveCSS('opacity', '1');
    } finally {
      await context.close();
    }
  },
);

test('real CRM desktop photo rail and thumbnails stay in sync', { timeout: 90000 }, async () => {
  const context = await openSession(1366);
  try {
    const page = await context.newPage();
    await page.goto(origin + '/viaturas/' + fullStripId);
    await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1', {
      timeout: 30000,
    });
    const surface = page.locator('.photo-preview .photo-open');
    const strip = page.locator('.thumbnail-frame .detail-thumbnails');
    const gallery = page.locator('.photo-preview');
    const thumbnail = (index) =>
      strip.getByRole('button', { name: `Selecionar fotografia ${index}`, exact: true });
    await expect(surface).toHaveAccessibleName('Ampliar fotografia 1 de 16');
    await expect(page.locator('.vehicle-record-times time')).toHaveCount(1);
    const next = page.getByRole('button', { name: 'Avançar duas miniaturas' });
    await next.click();
    await expect.poll(() => strip.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await expect(thumbnail(1)).toHaveAttribute('aria-pressed', 'true');
    await thumbnail(4).click();
    await expect(surface).toHaveAccessibleName('Ampliar fotografia 4 de 16');
    await gallery.hover();
    await gallery.getByRole('button', { name: 'Fotografia seguinte' }).click();
    await expect(thumbnail(5)).toHaveAttribute('aria-pressed', 'true');
    await expect(surface.locator('.photo-track')).toHaveAttribute('data-moving', 'false');
    const box = await surface.boundingBox();
    assert.ok(box);
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x - 85, center.y, { steps: 4 });
    await page.mouse.up();
    await expect(thumbnail(6)).toHaveAttribute('aria-pressed', 'true');
    const viewer = page.locator('.crm-photo-viewer');
    await expect(viewer).toBeHidden();
    await surface.press('Enter');
    await expect(viewer.locator('.viewer-footer p')).toHaveText('Fotografia 6 de 16');
    await expect(viewer.locator('.viewer-step')).toHaveCount(2);
    await expect(viewer.locator('.viewer-thumbnails')).toHaveCount(0);
    await viewer.getByRole('button', { name: 'Fechar fotografia' }).click();
    await expect(viewer).toBeHidden();
  } finally {
    await context.close();
  }
});

test(
  'real CRM drawer closes on mobile and preserves the desktop collapse preference',
  { timeout: 90000 },
  async () => {
    const context = await openSession(1366);
    try {
      const page = await context.newPage();
      await page.goto(origin + '/viaturas');
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1', {
        timeout: 30000,
      });
      const sidebar = page.locator('.sidebar');
      const minimize = sidebar.getByRole('button', { name: 'Colapsar menu' });
      await minimize.hover();
      const strongBorder = await desktopHoverBorder(page);
      await expect(minimize).toHaveCSS('border-top-color', strongBorder);
      await minimize.click();
      await expect(sidebar).toHaveClass(/collapsed/);
      await page.setViewportSize({ width: 390, height: 740 });
      const menu = page.getByRole('button', { name: 'Abrir menu' });
      await menu.click();
      await expect(sidebar).not.toHaveClass(/collapsed/);
      await sidebar.getByRole('button', { name: 'Fechar navegação' }).click();
      await expect(sidebar).toBeHidden();
      await expect(menu).toBeFocused();
      await page.setViewportSize({ width: 1366, height: 740 });
      const expand = sidebar.getByRole('button', { name: 'Expandir menu' });
      await expect(expand).toHaveAttribute('aria-expanded', 'false');
      await expect
        .poll(() =>
          sidebar.evaluate((node) => {
            const rail = node.getBoundingClientRect();
            const button = node.querySelector('.sidebar-toggle').getBoundingClientRect();
            return Math.abs(button.left + button.width / 2 - (rail.left + rail.width / 2));
          }),
        )
        .toBeLessThan(1);
      await expand.click();
      await expect(minimize).toHaveAttribute('aria-expanded', 'true');
    } finally {
      await context.close();
    }
  },
);

async function checkMobileEditStatus(page) {
  let finishSave;
  let shouldFail = true;
  await page.route('**/editar/save', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (!shouldFail) return route.fulfill({ json: { ok: true } });
    await new Promise((resolve) => (finishSave = resolve));
    return route.fulfill({ status: 400, json: { error: 'Erro de gravação simulado.' } });
  });
  await page.goto(origin + '/viaturas/' + vehicleId + '/editar');
  const toolbar = page.locator('#vehicle-edit-actions');
  const status = page.locator('.bn-edit-status');
  const mileage = page.locator('input[name="mileage"]');
  const save = toolbar.getByRole('button', { name: 'Guardar alterações', exact: true });
  const scrollDown = () => page.evaluate(() => scrollTo(0, 1100));
  await expect(toolbar).toHaveCSS('position', 'static');
  await expect(save).toBeDisabled();
  await scrollDown();
  await expect(toolbar).not.toBeInViewport();
  await expect(status).toHaveText('Tudo guardado');
  await expect(status.locator('[data-tone]')).toHaveAttribute('data-tone', 'saved');
  const deleteButton = page.getByRole('button', { name: 'Eliminar viatura', exact: true });
  await expect
    .poll(async () => {
      await page.evaluate(() =>
        scrollTo({ top: document.scrollingElement.scrollHeight, behavior: 'instant' }),
      );
      return deleteButton.evaluate((button) => {
        const bottomNav = document.querySelector('.bottom-nav').getBoundingClientRect();
        const box = button.getBoundingClientRect();
        return {
          fits: box.top >= 0 && box.bottom < bottomNav.top,
          reachable: button.contains(
            document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
          ),
        };
      });
    })
    .toEqual({ fits: true, reachable: true });
  await mileage.fill('91000');
  await scrollDown();
  await expect(status).toHaveText('Alterações por guardar');
  await expect(status.locator('[data-tone]')).toHaveAttribute('data-tone', 'dirty');
  await expect(page.getByRole('button', { name: 'Guardar alterações', exact: true })).toHaveCount(
    1,
  );
  assert.ok(await status.evaluate((node) => node.parentElement.matches('.bottom-nav')));
  await save.tap();
  const warning = page.getByRole('button', { name: 'Confirmar e guardar alterações' });
  await warning.tap();
  await expect.poll(() => Boolean(finishSave)).toBe(true);
  try {
    await scrollDown();
    await expect(status).toHaveText('A guardar…');
  } finally {
    finishSave();
  }
  await expect(status).toHaveText('Rever alterações');
  await expect(status.locator('[data-tone]')).toHaveAttribute('data-tone', 'error');
  await expect(mileage).toHaveValue('91000');
  shouldFail = false;
  await save.tap();
  await warning.tap();
  await expect(page).toHaveURL(new RegExp('/viaturas/' + vehicleId + '$'));
  await expect(status).toHaveCount(0);
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
      const overlay = page.locator('.drawer-overlay');
      const backdrop = page.getByRole('button', { name: 'Fechar menu', exact: true });
      await expect(backdrop).toBeVisible();
      if (await page.evaluate(() => CSS.supports('-webkit-tap-highlight-color', 'transparent'))) {
        await expect(backdrop).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
      }
      await expect(overlay).toHaveCSS('opacity', '1');
      await expect(backdrop).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(backdrop).toHaveCSS('box-shadow', 'none');
      if (reduced) await expect(overlay).toHaveCSS('transition-property', 'none');
      await backdrop.tap({ position: { x: width - 12, y: 120 } });
      await expect(backdrop).toHaveCount(0);
      await expect(overlay).toHaveCSS('opacity', '0');
      await expect(hamburger).toBeFocused();
      await hamburger.tap();
      await sidebar.getByRole('button', { name: 'Fechar navegação' }).tap();
      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      await expect(sidebar).toBeHidden();
      await hamburger.tap();
      await expect(backdrop).toBeVisible();
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

for (const width of [320, 390]) {
  test(
    `real CRM mobile vehicle rows and edit status at ${width}px`,
    { timeout: 150000 },
    async () => {
      const context = await openSession(width);
      try {
        const page = await context.newPage();
        await page.goto(origin + '/viaturas', { waitUntil: 'commit', timeout: 60000 });
        await expect(page.getByText('25 no inventário')).toBeVisible({ timeout: 60000 });
        await expect(
          page.locator('.topbar').getByRole('button', { name: 'Alertas', exact: true }),
        ).toContainText('1', { timeout: 30000 });
        await checkVehicleRows(page, width);
        await checkMobileEditStatus(page);
      } finally {
        await context.close();
      }
    },
  );
}

test(
  'real CRM detail and edit keep separate history positions and search stays isolated',
  { timeout: 150000 },
  async () => {
    const context = await openSession(390);
    try {
      const page = await context.newPage();
      const detail = '/viaturas/' + vehicleId;
      const edit = detail + '/editar';
      const heading = page.getByRole('heading', {
        name: vehicle.brand + ' ' + vehicle.model,
        exact: true,
      });
      const scroll = (top) => page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), top);
      const position = () => page.evaluate(() => scrollY);
      const results = [];
      for (const y of [0, 430]) {
        await page.goto(origin + detail);
        await expect(heading).toBeVisible();
        const editLink = page
          .locator('.vehicle-actions')
          .getByRole('link', { name: 'Editar', exact: true });
        await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText(
          '1',
          { timeout: 30000 },
        );
        await scroll(y);
        const savedDetailY = await position();
        await editLink.evaluate((link) => link.click());
        await expect(page).toHaveURL(origin + edit);
        const mileage = page.locator('input[name="mileage"]');
        await expect(mileage).toHaveValue('84250');
        await scroll(1050);
        const savedEditY = await position();
        await page.evaluate(() => {
          window.detailReturnY = [];
          const observe = () => {
            if (document.querySelector('.vehicle-actions')) window.detailReturnY.push(scrollY);
            if (window.detailReturnY.length < 18) requestAnimationFrame(observe);
          };
          requestAnimationFrame(observe);
          history.back();
        });
        await expect(page).toHaveURL(origin + detail);
        await expect(heading).toBeVisible();
        await page.waitForFunction(() => window.detailReturnY.length === 18);
        const samples = await page.evaluate(() => window.detailReturnY);
        results.push({ savedDetailY, savedEditY, first: samples[0], last: samples.at(-1) });
        await page.evaluate(() => history.forward());
        await expect(page).toHaveURL(origin + edit);
        await expect(mileage).toHaveValue('84250');
        await expect
          .poll(async () => Math.abs((await position()) - savedEditY))
          .toBeLessThanOrEqual(2);
        if (y) {
          await mileage.fill('91234');
          await page.evaluate(() => history.back());
          await expect(page.getByRole('heading', { name: 'Sair desta página?' })).toBeVisible();
          await page.getByRole('button', { name: 'Ficar na página' }).click();
          await expect(page).toHaveURL(origin + edit);
          await expect(mileage).toHaveValue('91234');
        }
      }
      console.log('Edit history samples', JSON.stringify(results));

      await page.goto(origin + '/viaturas');
      await expect(page.getByText('25 no inventário')).toBeVisible();
      const task = page.locator('.qt-panel.is-mobile');
      const addTask = page.getByRole('button', { name: 'Nova tarefa rápida' });
      const search = page.getByRole('button', { name: 'Pesquisar', exact: true });
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1');
      await expect(search).toHaveCSS('border-radius', '50%');
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toHaveCSS(
        'border-radius',
        '50%',
      );
      const addVehicle = page.locator('.tb-add-icon');
      await expect(addVehicle).toHaveCSS('height', '44px');
      await expect(search).toHaveCSS('height', '44px');
      await addTask.tap();
      await expect(task).toBeInViewport();
      await task.getByRole('button', { name: 'Fechar', exact: true }).tap();
      await scroll(650);
      await expect(page.locator('.topbar')).toBeHidden();
      await scroll(380);
      await expect(search).toBeInViewport();
      await page.evaluate(() => {
        window.searchTargets = [];
        for (const eventType of ['pointerdown', 'touchstart', 'click']) {
          document.addEventListener(
            eventType,
            (event) => {
              const target = event.target.closest('button');
              if (target) window.searchTargets.push([eventType, target.getAttribute('aria-label')]);
            },
            { capture: true, passive: true },
          );
        }
      });
      await search.tap();
      const input = page.getByRole('combobox', { name: 'Pesquisar' });
      await expect(input).toBeFocused();
      await expect(page.locator('.tb-search-expanded .gs-input-shell')).toHaveCSS(
        'border-radius',
        '10px',
      );
      await input.fill('BMW');
      await expect(page.getByRole('option', { name: /BMW Série 3/ })).toBeVisible();
      await page.evaluate(() => {
        Object.defineProperty(visualViewport, 'height', {
          configurable: true,
          value: innerHeight - 290,
        });
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await page.waitForTimeout(400);
      const panel = await task.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const y = Math.max(0, bounds.top + 20);
        return {
          top: bounds.top,
          viewport: innerHeight,
          visibility: getComputedStyle(node).visibility,
          hidden: node.inert,
          hit: node.contains(document.elementFromPoint(innerWidth / 2, y)),
        };
      });
      console.log('Closed task panel with search viewport', JSON.stringify(panel));
      assert.ok(
        results.every(
          ({ savedDetailY, first, last }) =>
            Math.abs(first - savedDetailY) <= 2 && Math.abs(last - savedDetailY) <= 2,
        ),
      );
      assert.equal(panel.visibility, 'hidden');
      assert.ok(panel.hidden && !panel.hit && panel.top >= panel.viewport - 1);
      const targets = await page.evaluate(() => window.searchTargets);
      assert.ok(targets.some(([type, target]) => type === 'click' && target === 'Pesquisar'));
      assert.ok(targets.every(([, target]) => target !== 'Nova tarefa rápida'));
      await page.evaluate(() => {
        delete visualViewport.height;
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await page.keyboard.press('Escape');
      await addTask.tap();
      await expect(task).toBeInViewport();
      await page.keyboard.press('Control+k');
      await expect(input).toBeFocused();
      await expect(task).toBeHidden();
      await page.goto(origin + detail);
      await expect(heading).toBeVisible();
      await expect(page.getByRole('button', { name: 'Alertas', exact: true })).toContainText('1');
      await search.tap();
      await expect(input).toBeFocused();
      await expect(task).toBeHidden();
    } finally {
      await context.close();
    }
  },
);

test('real CRM create, draft and edit numeric forms', { timeout: 120000 }, async () => {
  const context = await openSession(1366);
  try {
    const page = await context.newPage();
    await page.goto(origin + '/viaturas', { waitUntil: 'commit', timeout: 60000 });
    await expect(page.getByText('25 no inventário')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.tb-theme button')).toHaveCSS('border-radius', '50%');
    await expect(page.locator('.tb-theme button')).toHaveCSS('height', '44px');
    await expect(page.locator('.tb-add-label')).toHaveCSS('height', '44px');
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
    await expect(page.locator('#vehicle-edit-actions')).toHaveCSS('position', 'sticky');
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
