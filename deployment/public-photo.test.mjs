import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { photoBackendPath } from './public-photo.mjs';
import { createGateway } from './gateway.mjs';
import { config } from './routing.mjs';
const slug = 'dacia-jogger-abcdef123456';
const path = `/viaturas/${slug}/photos/0?w=320`;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });

test('only exact public photo reads qualify, preserving legacy/invalid handling', () => {
  assert.equal(photoBackendPath('GET', path), `/api/public/vehicles/${slug}/photos/0?w=320`);
  assert.equal(photoBackendPath('HEAD', path), `/api/public/vehicles/${slug}/photos/0?w=320`);
  for (const candidate of [path.replace('320', '999'), path + '&token=x', path.replace('/0?', '/20?'),
    path.replace(slug, 'invalid'), path.replace('viaturas', 'crm'), path.replace('?w=320', ''),
    path.replace('/photos/', '/%2e%2e/photos/')]) assert.equal(photoBackendPath('GET', candidate), null);
  assert.equal(photoBackendPath('POST', path), null);
});

test('fast relay keeps authorization, cache validation, bytes, bounds and credential isolation', async () => {
  let mode = 'image';
  let finishPhoto;
  let calls = 0;
  const seen = [];
  const bytes = Buffer.from('unchanged-photo');
  const backend = http.createServer((req, res) => {
    calls++; seen.push({ url: req.url, headers: req.headers });
    if (mode === 'revoked') { res.writeHead(404); res.end('private reason'); return; }
    if (mode === 'error') { res.writeHead(500); res.end('private error'); return; }
    if (mode === 'redirect') { res.writeHead(302, { location: 'https://example.invalid' }); res.end(); return; }
    if (req.headers['if-none-match'] === '"photo"') {
      res.writeHead(304, { etag: '"photo"' }); res.end(); return;
    }
    res.writeHead(200, {
      'content-type': mode === 'invalid' ? 'text/html' : 'image/webp',
      'content-length': mode === 'oversize' ? 21 * 1024 * 1024 : bytes.length,
      etag: '"photo"', 'x-photo-version': 'a'.repeat(64), 'x-photo-cache-policy': 'shared-v1',
      'x-photo-warmup': 'requested-v1',
      'server-timing': mode === 'metadata' ? 'database;desc="private"' : 'photo-check;dur=24.0',
      'set-cookie': 'secret=not-for-browser', 'x-private': 'private',
    });
    if (mode === 'stream') {
      res.write(bytes.subarray(0, 5));
      finishPhoto = () => res.end(bytes.subarray(5));
      return;
    }
    if (mode === 'truncated') { res.end(bytes.subarray(0, 5)); return; }
    res.end(bytes);
  });
  const website = http.createServer((_req, res) => res.end('website fallback'));
  const ports = { backend: await listen(backend), website: await listen(website), crm: 9 };
  const gateway = createGateway(config({ WEBSITE_ORIGIN: 'http://127.0.0.1:12345' }), ports, () => true, new Set());
  const port = await listen(gateway);
  const request = (url = path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, method,
      headers: { host: '127.0.0.1:12345', ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end();
  });
  try {
    const photo = await request(path, { cookie: 'crm=private', authorization: 'Bearer private' });
    assert.equal(photo.status, 200); assert.deepEqual(photo.bytes, bytes);
    assert.equal(photo.headers['x-photo-delivery'], 'gateway-v2');
    assert.equal(photo.headers['x-photo-warmup'], 'requested-v1');
    assert.equal(photo.headers['cache-control'], 'private, no-cache, max-age=0, must-revalidate');
    assert.equal(photo.headers['set-cookie'], undefined); assert.equal(photo.headers['x-private'], undefined);
    assert.equal(photo.headers['server-timing'], 'photo-check;dur=24.0');
    assert.equal(seen[0].headers.cookie, undefined); assert.equal(seen[0].headers.authorization, undefined);
    assert.equal(seen[0].url, `/api/public/vehicles/${slug}/photos/0?w=320`);
    const unchanged = await request(path, { 'if-none-match': '"photo"' });
    assert.equal(unchanged.status, 304); assert.equal(unchanged.bytes.length, 0);
    assert.equal(calls, 2); // Every request still reaches the authorization route.
    mode = 'revoked';
    const revoked = await request(path, { 'if-none-match': '"photo"' });
    assert.equal(revoked.status, 404); assert.equal(revoked.bytes.length, 0);
    assert.equal(revoked.headers['cache-control'], 'no-store');
    for (mode of ['error', 'redirect', 'oversize', 'invalid']) {
      const response = await request(); assert.equal(response.status, 503); assert.equal(response.bytes.length, 0);
      assert.equal(response.headers.location, undefined);
    }
    mode = 'metadata';
    assert.equal((await request()).headers['server-timing'], undefined);
    mode = 'image';
    assert.equal((await request(path, {}, 'HEAD')).bytes.length, 0);
    mode = 'truncated';
    await assert.rejects(request());
    mode = 'stream';
    let finish;
    const done = new Promise((resolve, reject) => {
      const req = http.get({ hostname: '127.0.0.1', port, path, headers: { host: '127.0.0.1:12345' } }, res => {
        const chunks = [];
        res.on('data', chunk => {
          chunks.push(chunk);
          if (finishPhoto) { const release = finishPhoto; finishPhoto = null; release(); }
        });
        res.on('end', () => { assert.deepEqual(Buffer.concat(chunks), bytes); resolve(); });
        res.on('error', reject);
      });
      req.on('error', reject);
      finish = setTimeout(() => { req.destroy(); reject(new Error('First chunk was buffered')); }, 1000);
    });
    try { await done; } finally { clearTimeout(finish); }
    assert.equal((await request(path.replace('320', '999'))).bytes.toString(), 'website fallback');
    assert.equal((await request(path, { host: 'evil.invalid' })).status, 421);
  } finally { await close(gateway); await close(backend); await close(website); }
});
