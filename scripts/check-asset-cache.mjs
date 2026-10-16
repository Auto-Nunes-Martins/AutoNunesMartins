// Run after building website and CRM (CRM_BASE_PATH=/crm). No real services/keys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createGateway } from '../deployment/gateway.mjs';
import { config } from '../deployment/routing.mjs';

const listen = async server => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
};
const freePort = async () => {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
};
const children = [];
const servers = [];
const immutable = 'public,max-age=31536000,immutable';
const logs = [];
try {
  const ports = { website: await freePort(), crm: await freePort() };
  const backend = http.createServer((_req, res) => {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end('{"error":"fixture backend unavailable"}');
  });
  ports.backend = await listen(backend);
  servers.push(backend);
  const gatewayPort = await freePort();
  const origin = `http://127.0.0.1:${gatewayPort}`;
  const settings = config({ WEBSITE_ORIGIN: origin, CRM_BASE_PATH: '/crm' });
  const gateway = createGateway(settings, ports);
  gateway.listen(gatewayPort, '127.0.0.1');
  await once(gateway, 'listening');
  servers.push(gateway);
  for (const app of ['website', 'crm']) {
    const child = spawn(process.execPath, ['build/index.js'], {
      cwd: `apps/${app}`,
      env: {
        SystemRoot: process.env.SystemRoot,
        PATH: process.env.PATH,
        HOST: '127.0.0.1', PORT: String(ports[app]), ORIGIN: origin,
        INTERNAL_BACKEND_URL: `http://127.0.0.1:${ports.backend}`,
        PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Zml4dHVyZS5jbGVyay5hY2NvdW50cy5kZXYk',
        CLERK_SECRET_KEY: 'sk_test_fixture',
        CONTACT_ENABLED: 'false', CONTACT_PRIVACY_READY: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => logs.push(String(chunk)));
    child.stderr.on('data', chunk => logs.push(String(chunk)));
    children.push(child);
  }
  const call = (url, options = {}) => fetch(origin + url, {
    redirect: 'manual', signal: AbortSignal.timeout(15000), ...options,
  });
  for (const prefix of ['', '/crm']) {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (children.some(child => child.exitCode !== null)) throw Error(logs.join(''));
      if ((await call(`${prefix}/logo-transparent.png`)).status === 200) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, `app listening: ${prefix}`);
  }
  let count = 0;
  for (const app of ['website', 'crm']) {
    const prefix = app === 'crm' ? '/crm' : '';
    const sourceRoot = `apps/${app}/src/lib/assets`;
    const outputRoot = `apps/${app}/build/client${prefix}/_app/immutable/assets`;
    const sources = fs.readdirSync(sourceRoot, { recursive: true }).map(file => path.join(sourceRoot, file)).filter(file => fs.statSync(file).isFile());
    if (app === 'website') sources.push('apps/website/assets/orbit-startup.js');
    const outputs = fs.readdirSync(outputRoot);
    for (const source of sources) {
      if (source.startsWith(sourceRoot)) {
        assert.deepEqual(fs.readFileSync(source), fs.readFileSync(path.join(`apps/${app}/static`, path.relative(sourceRoot, source))), `original image unchanged: ${source}`);
      }
      const { name, ext } = path.parse(source);
      const file = outputs.find(file => file.startsWith(name + '.') && file.endsWith(ext));
      assert(file, `emitted hashed asset for ${source}`);
      const url = `${prefix}/_app/immutable/assets/${file}`;
      const response = await call(url);
      assert.equal(response.status, 200, url);
      assert.equal(response.headers.get('cache-control'), immutable, url);
      assert.equal(response.headers.get('set-cookie'), null, url);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), fs.readFileSync(source), `unchanged bytes: ${url}`);
      if (app === 'crm') assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
      const head = await call(url, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get('cache-control'), immutable);
      const conditional = await call(url, { headers: { 'if-none-match': response.headers.get('etag') } });
      assert.equal(conditional.status, 304, url);
      assert.equal(conditional.headers.get('cache-control'), immutable, `conditional ${url}`);
      count++;
    }
  }
  for (const url of ['/', '/quem-somos', '/viaturas', '/crm/', '/crm/dashboard', '/crm/api/users', '/crm/nonexistent', '/api/users', '/api/public/vehicles', '/robots.txt', '/sitemap.xml', '/logo-transparent.png', '/crm/logo-transparent.png', '/_app/immutable/assets/missing.png', '/crm/_app/immutable/assets/missing.png']) {
    const response = await call(url);
    assert(!response.headers.get('cache-control')?.includes('immutable'), `fresh/private response: ${url}`);
    if (url.startsWith('/crm') || url.startsWith('/api/')) assert.equal(response.headers.get('cache-control'), 'private, no-store', url);
    if (['/', '/quem-somos', '/viaturas', '/crm/'].includes(url)) {
      assert.equal(response.status, url === '/viaturas' ? 503 : 200, url);
      const html = await response.text();
      assert(!html.includes('%anm.startup%'), 'startup template resolved');
      assert(!/(?:src|href)=["'][^"']*\/(?:logo-transparent(?:-white-v3)?\.png|catalog-placeholder\.svg|orbit-startup\.js)/.test(html), `no fixed UI assets: ${url}`);
      if (!url.startsWith('/crm')) {
        assert.match(html, /<script src="\/_app\/immutable\/assets\/orbit-startup\.[\w-]+\.js"><\/script>/);
        assert(html.indexOf('orbit-startup.') < html.indexOf('<body'), 'classic startup stays parser blocking in head');
      }
      for (const match of html.matchAll(/(?:src|href)="([^" ]*\/_app\/immutable\/[^" ]+)"/g)) {
        const asset = new URL(match[1], origin + url).pathname;
        const resource = await call(asset);
        assert.equal(resource.status, 200, `SSR reference resolves: ${asset}`);
        assert.equal(resource.headers.get('cache-control'), immutable, `SSR JS/CSS/font cache: ${asset}`);
      }
    }
  }
  console.log(`Asset cache smoke passed: ${count} byte-identical versioned assets, GET/HEAD/304 through gateway; SSR and private/fresh responses verified.`);
} finally {
  for (const child of children) child.kill();
  await Promise.all(servers.map(server => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  })));
  await Promise.all(children.map(child => child.exitCode !== null ? undefined : once(child, 'exit')));
}
