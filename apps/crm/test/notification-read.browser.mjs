// Real notification components; all events/receipts below are isolated test data.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as httpServer } from 'node:http';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { chromium, expect } from '@playwright/test';

const crm = fileURLToPath(new URL('../', import.meta.url));
let server,
  vite,
  browser,
  origin,
  events = [],
  receipts = new Map(),
  failAfterRead = false,
  failGet = false,
  failPost = false,
  holdNext = false,
  held,
  heldReady;
const event = (letter, name) => ({
  id: 'contact:' + letter.repeat(64),
  name,
  subject: 'Pedido de visita',
  createdAt: '2026-11-01T10:00:00Z',
  read: false,
});
const reset = () => {
  events = [event('a', 'Ana')];
  receipts = new Map();
  failAfterRead = false;
  failGet = false;
  failPost = false;
  holdNext = false;
  held = undefined;
};
const payload = (user) => {
  const items = events.filter((e) => !receipts.get(user)?.has(e.id));
  return {
    alerts: { stockAged: 2, tasksDueOrOverdue: 0, remindersToday: 0, draftVehicles: 0 },
    contacts: { unread: items.length, items },
    total: 2 + items.length,
    recent: [],
  };
};
before(async () => {
  await mkdir(path.join(crm, '.svelte-kit'), { recursive: true });
  const directory = await mkdtemp(path.join(crm, '.svelte-kit/notification-read-'));
  const write = (name, text) => writeFile(path.join(directory, name), text);
  await write('package.json', '{"type":"module"}');
  await write('paths.js', "export const base='/crm';");
  await write('session.js', 'export const sessionFetch=(...args)=>fetch(...args);');
  await write(
    'App.svelte',
    `<script>import Bell from '$lib/components/shell/NotificationBell.svelte';</script><main style="position:absolute;top:24px;right:24px"><Bell/></main>`,
  );
  await write('review.css', "@import '../../src/app.css';\n@source '../../src';");
  await write(
    'client.js',
    `import './review.css';import{mount}from'svelte';import App from './App.svelte';const original=setInterval;window.setInterval=(callback,delay,...args)=>{if(delay===60000)window.pollNotifications=callback;return original(callback,delay,...args);};document.documentElement.dataset.theme='dark';mount(App,{target:document.querySelector('#app')});`,
  );
  server = httpServer(async (req, res) => {
    const url = new URL(req.url, 'http://fixture'),
      user = req.headers['x-fixture-user'] ?? 'alice';
    const reply = (status, data) => {
      res.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'private, no-store',
      });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === '/crm/api/notifications') {
      if (failGet) {
        failGet = false;
        reply(503, { error: 'isolated refresh failure' });
        return;
      }
      const snapshot = payload(user);
      if (holdNext) {
        holdNext = false;
        held = () => reply(200, snapshot);
        heldReady?.();
        return;
      }
      reply(200, snapshot);
      return;
    }
    if (url.pathname.startsWith('/crm/api/notifications/contacts/') && req.method === 'POST') {
      if (failPost) {
        failPost = false;
        reply(503, { error: 'isolated write failure' });
        return;
      }
      const id = decodeURIComponent(url.pathname.split('/')[5]);
      if (!events.some((e) => e.id === id)) {
        reply(404, {});
        return;
      }
      if (!receipts.has(user)) receipts.set(user, new Set());
      receipts.get(user).add(id);
      if (failAfterRead) {
        failAfterRead = false;
        failGet = true;
      }
      reply(200, { ok: true });
      return;
    }
    if (['/one', '/two'].includes(url.pathname)) {
      const html = await vite.transformIndexHtml(
        '/',
        `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/client.js"></script></body></html>`,
      );
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html);
      return;
    }
    vite.middlewares(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  vite = await createServer({
    configFile: false,
    root: directory,
    plugins: [tailwindcss(), svelte({ configFile: false })],
    resolve: {
      alias: [
        { find: '$lib/auth/session', replacement: path.join(directory, 'session.js') },
        { find: '$app/paths', replacement: path.join(directory, 'paths.js') },
        { find: '$lib', replacement: path.join(crm, 'src/lib') },
      ],
    },
    server: { middlewareMode: true, hmr: { server }, fs: { allow: [path.resolve(crm, '../..')] } },
    logLevel: 'error',
  });
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
});
after(async () => {
  await browser?.close();
  await vite?.close();
  if (server)
    await new Promise((resolve) =>
      server.close(resolve),
    ); /* Keep fixtures; no automatic cleanup. */
});
async function open(page) {
  await page.goto(origin + '/one');
  await page.getByRole('button', { name: 'Alertas', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar contacto de Ana como lido' }).waitFor();
}
const mark = (page) => page.getByRole('button', { name: 'Marcar contacto de Ana como lido' });
const badge = (page) => page.getByRole('button', { name: 'Alertas', exact: true }).locator('span');

for (const width of [1440, 390])
  test(`confirmed read stays hidden when refresh fails and across reload/navigation/new session at ${width}px`, async () => {
    reset();
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        extraHTTPHeaders: { 'x-fixture-user': 'alice' },
      }),
      page = await context.newPage();
    try {
      await open(page);
      await expect(badge(page)).toHaveText('3');
      failAfterRead = true;
      await mark(page).click();
      await expect(page.getByRole('status')).toContainText('Não foi possível atualizar');
      await expect(mark(page)).toHaveCount(0);
      await expect(badge(page)).toHaveText('2');
      assert.equal(receipts.get('alice').size, 1);
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await expect(page.getByRole('status')).toHaveCount(0);
      await page.evaluate(() => window.pollNotifications());
      await expect(mark(page)).toHaveCount(0);
      await page.reload();
      await page.getByRole('button', { name: 'Alertas', exact: true }).click();
      await expect(badge(page)).toHaveText('2');
      await expect(mark(page)).toHaveCount(0);
      await page.goto(origin + '/two');
      await page.getByRole('button', { name: 'Alertas', exact: true }).click();
      await expect(badge(page)).toHaveText('2');
      await expect(mark(page)).toHaveCount(0);
    } finally {
      await context.close();
    }
    const next = await browser.newContext({ extraHTTPHeaders: { 'x-fixture-user': 'alice' } }),
      fresh = await next.newPage();
    try {
      await fresh.goto(origin + '/one');
      await fresh.getByRole('button', { name: 'Alertas', exact: true }).click();
      await expect(badge(fresh)).toHaveText('2');
      await expect(mark(fresh)).toHaveCount(0);
    } finally {
      await next.close();
    }
  });

test('failed receipt remains unread; stale poll cannot resurrect a confirmed read; new events and other users stay independent', async () => {
  reset();
  const alice = await browser.newContext({ extraHTTPHeaders: { 'x-fixture-user': 'alice' } }),
    bob = await browser.newContext({ extraHTTPHeaders: { 'x-fixture-user': 'bob' } }),
    page = await alice.newPage(),
    other = await bob.newPage();
  try {
    await open(page);
    failPost = true;
    await mark(page).click();
    await expect(page.getByRole('status')).toContainText('marcar o contacto como lido');
    await expect(mark(page)).toHaveCount(1);
    assert.equal(receipts.size, 0);
    const waiting = new Promise((resolve) => (heldReady = resolve));
    holdNext = true;
    await page.evaluate(() => window.pollNotifications());
    await waiting;
    await mark(page).click();
    await expect(mark(page)).toHaveCount(0);
    held();
    await expect(badge(page)).toHaveText('2');
    await open(other);
    await expect(badge(other)).toHaveText('3');
    await expect(mark(other)).toHaveCount(1);
    events.push(event('b', 'João'));
    await page.evaluate(() => window.pollNotifications());
    await page.getByRole('button', { name: 'Marcar contacto de João como lido' }).waitFor();
    await expect(mark(page)).toHaveCount(0);
    await expect(badge(page)).toHaveText('3');
    await other.evaluate(() => window.pollNotifications());
    await expect(badge(other)).toHaveText('4');
  } finally {
    await alice.close();
    await bob.close();
  }
});
