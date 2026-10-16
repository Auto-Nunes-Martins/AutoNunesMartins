import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { config, selectRoute } from './routing.mjs';
import { createGateway } from './gateway.mjs';
const settings = config({ WEBSITE_ORIGIN: 'https://trial.onrender.com', CRM_BASE_PATH: '/crm' });
test('explicit host and prefix boundaries; encoded/dot paths are rejected', () => {
  for (const [url, service] of [
    ['/', 'website'],
    ['/crm', 'crm'],
    ['/crm/_app/a.js', 'crm'],
    ['/crm/api/users', 'crm'],
    ['/api/public/vehicles', 'backend'],
    ['/api/contact', 'website'],
    ['/crmobile', 'website'],
    ['/healthz', 'health'],
  ]) {
    assert.equal(selectRoute(settings, 'trial.onrender.com', url)?.service, service);
  }
  for (const url of [
    '//evil.test',
    '/crm/../api/users',
    '/crm%2fapi/users',
    '/crm\\api',
    '/crm/%2e%2e/',
  ])
    assert.equal(selectRoute(settings, 'trial.onrender.com', url), null);
  assert.equal(selectRoute(settings, 'evil.test', '/'), null);
  assert.equal(settings.noindex, true);
  const production = config({
    WEBSITE_ORIGIN: 'https://public.example',
    CRM_ORIGIN: 'https://crm.example',
    CRM_BASE_PATH: '',
  });
  assert.equal(production.noindex, false);
  assert.equal(selectRoute(production, 'crm.example', '/dashboard').service, 'crm');
  assert.throws(() => config({ WEBSITE_ORIGIN: 'https://public.example/a' }));
  assert.throws(() => config({ WEBSITE_ORIGIN: 'https://public.example', CRM_BASE_PATH: '' }));
});
const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) =>
  new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
test('proxy isolation, forwarded-header injection, POST origin, bearer API and errors', async () => {
  const servers = [];
  const ports = {};
  for (const service of ['website', 'crm', 'backend']) {
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url.includes('revalidate')) {
        res.writeHead(304, { etag: '"fixture"' });
        res.end();
        return;
      }
      if (req.url.includes('immutable')) {
        res.setHeader('cache-control', 'public,max-age=31536000,immutable');
        res.setHeader('content-type', req.url.includes('html') ? 'text/html' : 'image/png');
        if (req.url.includes('missing')) res.statusCode = 404;
        if (req.url.includes('cookie')) res.setHeader('set-cookie', 'fixture=private');
      }
      if (req.url.includes('redirect')) {
        res.statusCode = 303;
        res.setHeader('location', '/crm/dashboard');
      }
      res.end(
        JSON.stringify({
          service,
          url: req.url,
          host: req.headers.host,
          forwarded: req.headers['x-forwarded-host'],
        }),
      );
    });
    servers.push(server);
    ports[service] = await listen(server);
  }
  const buildAssets = new Set(['logo.hash.png', 'missing.png', 'cookie.png', 'html.png', 'revalidate.png', 'redirect.png'].map(file => `/crm/_app/immutable/assets/${file}`));
  const gateway = createGateway(settings, ports, () => true, buildAssets);
  const port = await listen(gateway);
  const request = (url, options = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: url,
          method: options.method || 'GET',
          headers: { host: 'trial.onrender.com', ...options.headers },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () =>
            resolve(
              new Response(res.statusCode === 304 ? null : Buffer.concat(chunks), { status: res.statusCode, headers: res.headers }),
            ),
          );
        },
      );
      req.on('error', reject);
      req.end(options.body);
    });
  try {
    const publicPage = await request('/', { headers: { 'x-forwarded-host': 'evil.test' } });
    assert.equal(publicPage.headers.get('x-robots-tag'), 'noindex, follow');
    assert.deepEqual(await publicPage.json(), {
      service: 'website',
      url: '/',
      host: 'trial.onrender.com',
    });
    const crm = await request('/crm/_app/a.js');
    assert.equal(crm.headers.get('cache-control'), 'private, no-store');
    assert.equal((await crm.json()).service, 'crm');
    const immutable = await request('/crm/_app/immutable/assets/logo.hash.png');
    assert.equal(immutable.headers.get('cache-control'), 'public,max-age=31536000,immutable');
    assert.equal(immutable.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal((await request('/crm/_app/immutable/assets/revalidate.png', { headers: { 'if-none-match': '"fixture"' } })).headers.get('cache-control'), 'public,max-age=31536000,immutable');
    for (const path of [
      '/crm/_app/immutable/assets/missing.png',
      '/crm/_app/immutable/assets/cookie.png',
      '/crm/_app/immutable/assets/html.png',
      '/crm/_app/immutable/assets/unknown.hash.png',
      '/crm/_app/immutable/assets/redirect.png',
      '/crm/_app/immutable/assets/%6cogo.hash.png',
      '/crm/_app/immutable/assets/logo.hash.png/extra',
      '/crm/api/immutable.png',
      '/crm/immutable',
      '/crm/logo-transparent.png',
    ]) assert.equal((await request(path)).headers.get('cache-control'), 'private, no-store');
    assert.equal((await request('/api/public/immutable.png')).headers.get('cache-control'), 'private, no-store');
    assert.equal((await request('/crm/_app/immutable/assets/logo.hash.png', {
      method: 'POST', headers: { origin: 'https://trial.onrender.com' },
    })).headers.get('cache-control'), 'private, no-store');
    const redirect = await request('/crm/redirect');
    assert.equal(redirect.headers.get('location'), '/crm/dashboard');
    assert.equal(redirect.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal((await request('/api/users')).status, 401);
    assert.equal(
      (await request('/api/users', { headers: { authorization: 'Bearer fixture' } })).status,
      200,
    );
    assert.equal(
      (
        await request('/crm/api/tasks', {
          method: 'POST',
          headers: { origin: 'https://evil.test' },
        })
      ).status,
      403,
    );
    const action = await request('/crm/api/tasks', {
      method: 'POST',
      headers: { origin: 'https://trial.onrender.com' },
      body: 'hello',
    });
    assert.equal(action.status, 200);
    assert.equal(
      (
        await request('/', {
          headers: { host: 'evil.test', 'x-forwarded-host': 'trial.onrender.com' },
        })
      ).status,
      421,
    );
    assert.equal((await request('/healthz')).status, 200);
  } finally {
    await close(gateway);
    await Promise.all(servers.map(close));
  }
});
