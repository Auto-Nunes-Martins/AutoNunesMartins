// Real HTTP/SSR regression check with an isolated public API fixture; no CRM/storage access.
// Run from an installed checkout: node scripts/check-social-previews.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const website = path.join(root, 'apps/website');
const bytes = await readFile(path.join(website, 'static/images/social/auto-nunes-martins-v1.png'));
const homeBytes = await readFile(path.join(website, 'static/images/social/homepage-v2.jpg'));
const framedBytes = await sharp({
  create: { width: 1260, height: 900, channels: 3, background: '#416f74' },
})
  .jpeg()
  .toBuffer();
const catalogBytes = await sharp(homeBytes).jpeg().toBuffer();
const version = 'a'.repeat(64);
const vehicles = [true, false].map((photo, i) => ({
  slug: `audi-a3-${i ? 'abcdef123457' : 'abcdef123456'}`,
  brand: 'Audi',
  model: 'A3',
  year: 2022,
  fuel: 'DIESEL',
  mileage: 42000,
  price: '22000.00',
  currency: 'EUR',
  description: 'Viatura de teste SSR.',
  transmission: 'MANUAL',
  availability: 'AVAILABLE',
  photos: photo ? ['/api/public/vehicles/audi-a3-abcdef123456/photos/0'] : [],
  ...(photo ? { socialPhotoVersion: version } : {}),
  // Deliberate extra private field: the public projection must strip it.
  storageSecret: 'PRIVATE-FIXTURE-MUST-NOT-REACH-HTML',
}));
const facets = {
  brands: [{ value: 'Audi', count: 2 }],
  models: [{ value: 'A3', brand: 'Audi', count: 2 }],
  fuels: [],
  transmissions: [],
  year: { min: 2022, max: 2022 },
  mileage: { min: 42000, max: 42000 },
  price: { min: '22000.00', max: '22000.00' },
};
const api = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const route = url.pathname.replace('/api/public/vehicles', '');
  if (route === `/${vehicles[0].slug}/social-image` || route === '/social/catalog') {
    const photo = route.endsWith('/social-image');
    if (photo && url.searchParams.get('v') !== version) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': 'image/jpeg',
      ...(photo ? { 'x-social-photo-version': version } : {}),
    });
    response.end(photo ? framedBytes : catalogBytes);
    return;
  }
  if (route === `/${vehicles[0].slug}/photos/0`) {
    response.writeHead(200, { 'content-type': 'image/png' });
    response.end(bytes);
    return;
  }
  let data;
  if (route === '/brands') data = facets.brands;
  else if (!route || route === '/') {
    const page = Number(url.searchParams.get('pagina') ?? 1);
    const items = url.searchParams.get('marca') === 'Unknown' ? [] : vehicles.slice(page - 1, page);
    data = {
      items,
      total: items.length ? vehicles.length : 0,
      page,
      pageSize: 1,
      totalPages: items.length ? vehicles.length : 0,
      facets,
    };
  } else if (route.endsWith('/related')) data = [];
  else data = vehicles.find((vehicle) => route === `/${vehicle.slug}`);
  response.writeHead(data ? 200 : 404, { 'content-type': 'application/json' });
  response.end(JSON.stringify(data ?? {}));
});
api.listen(0, '127.0.0.1');
await once(api, 'listening');
// Let the OS select a free website port before starting Vite.
const portServer = createServer();
portServer.listen(0, '127.0.0.1');
await once(portServer, 'listening');
const port = portServer.address().port;
await new Promise((resolve) => portServer.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
  {
    cwd: website,
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_BACKEND_URL: `http://127.0.0.1:${api.address().port}`,
      SITE_NOINDEX: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
let logs = '';
child.stdout.on('data', (chunk) => (logs += chunk));
child.stderr.on('data', (chunk) => (logs += chunk));
const decode = (value) =>
  value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
function metadata(head, key) {
  return [...head.matchAll(/<meta\b[^>]*>/g)]
    .filter(([tag]) => tag.includes(`="${key}"`))
    .map(([tag]) => decode(/content="([^"]*)"/.exec(tag)?.[1] ?? ''));
}
function one(head, key) {
  const values = metadata(head, key);
  assert.equal(values.length, 1, key);
  assert.ok(values[0], key);
  return values[0];
}
try {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try {
      const response = await fetch(`${origin}/robots.txt`);
      if (response.ok) break;
    } catch {}
    if (i === 119) throw new Error(`Vite startup timeout: ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const brandImageRoutes = [
    '/',
    '/quem-somos',
    '/viaturas',
    '/viaturas?marca=Audi',
    '/viaturas?pagina=2',
    '/viaturas?marca=Audi&pagina=2',
  ];
  const noindexRoutes = [
    '/viaturas?marca=Audi&combustivel=DIESEL',
    '/viaturas?marca=Unknown',
    '/favoritos',
    '/comparar',
    '/informacao-legal',
    '/politica-de-privacidade',
    '/termos-de-utilizacao',
  ];
  const routes = [
    ...brandImageRoutes,
    ...noindexRoutes,
    ...vehicles.map((v) => `/viaturas/${v.slug}`),
  ];
  const agents = ['Discordbot/2.0', 'Twitterbot/1.0', 'facebookexternalhit/1.1', 'WhatsApp/2.0'];
  for (const [index, route] of routes.entries()) {
    const response = await fetch(origin + route, {
      headers: { 'user-agent': agents[index % agents.length] },
    });
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow', 'staging protection');
    const html = await response.text();
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1];
    assert.ok(head, route);
    const title = [...head.matchAll(/<title>(.*?)<\/title>/g)];
    assert.equal(title.length, 1, route);
    assert.equal(one(head, 'og:title'), decode(title[0][1]), route);
    assert.equal(one(head, 'twitter:title'), one(head, 'og:title'));
    assert.equal(one(head, 'og:description'), one(head, 'description'));
    assert.equal(one(head, 'twitter:description'), one(head, 'description'));
    assert.equal(one(head, 'og:type'), 'website');
    assert.equal(one(head, 'og:locale'), 'pt_PT');
    assert.equal(one(head, 'og:site_name'), 'Auto Nunes Martins');
    assert.equal(one(head, 'twitter:card'), 'summary_large_image');
    assert.equal(one(head, 'twitter:image'), one(head, 'og:image'));
    assert.equal(one(head, 'twitter:image:alt'), one(head, 'og:image:alt'));
    const canonical = [...head.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g)];
    // Demos retain their established noindex policy and have no canonical link.
    if (!route.startsWith('/demo/')) {
      assert.equal(canonical.length, 1, route);
      assert.equal(one(head, 'og:url'), decode(canonical[0][1]));
    }
    assert.equal(new URL(one(head, 'og:url')).origin, origin);
    assert.equal(new URL(one(head, 'og:image')).origin, origin);
    assert.ok(!html.includes('PRIVATE-FIXTURE-MUST-NOT-REACH-HTML'));
    const structuredData = [
      ...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
    ].map(([, json]) => JSON.parse(json));
    const primaryImages = structuredData.filter((entry) => 'primaryImageOfPage' in entry);
    if (brandImageRoutes.includes(route)) {
      const thumbnailUrl = `${origin}/images/auto-nunes-martins-miniatura.png`;
      assert.equal(decode(canonical[0][1]), origin + route);
      assert.deepEqual(primaryImages, [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          url: decode(canonical[0][1]),
          primaryImageOfPage: thumbnailUrl,
        },
      ]);
      assert.ok(!html.slice(html.indexOf('</head>')).includes('auto-nunes-martins-miniatura.png'));
      if (route === '/') {
        const thumbnail = await fetch(thumbnailUrl);
        assert.equal(thumbnail.status, 200);
        assert.equal(thumbnail.headers.get('content-type')?.split(';')[0], 'image/png');
        const { width, height } = await sharp(Buffer.from(await thumbnail.arrayBuffer())).metadata();
        assert.equal(width, 512);
        assert.equal(height, 512);
      }
    } else {
      assert.deepEqual(primaryImages, [], route);
    }
    const photo = route === `/viaturas/${vehicles[0].slug}`;
    const expectedBytes = photo ? framedBytes : bytes;
    if (photo) {
      assert.equal(
        one(head, 'og:image'),
        `${origin}/viaturas/${vehicles[0].slug}/social-image?v=${version}`,
      );
      assert.equal(one(head, 'og:image:width'), '1260');
      assert.equal(one(head, 'og:image:height'), '900');
      assert.equal(one(head, 'og:image:type'), 'image/jpeg');
    } else {
      const imagePath = '/images/social/auto-nunes-martins-v1.png';
      assert.equal(one(head, 'og:image'), origin + imagePath);
      assert.equal(one(head, 'og:image:width'), '1200');
      assert.equal(one(head, 'og:image:height'), '630');
      assert.equal(one(head, 'og:image:type'), 'image/png');
    }
    if (route.startsWith('/viaturas/audi-')) {
      const ld = structuredData[0];
      assert.equal(ld.url, one(head, 'og:url'));
      assert.equal(
        ld.image?.[0],
        photo ? `${origin}/viaturas/${vehicles[0].slug}/photos/0` : undefined,
        'brand fallback is not a vehicle photograph',
      );
    }
    if (noindexRoutes.includes(route)) assert.equal(one(head, 'robots'), 'noindex, follow');
    if (['/', '/quem-somos'].includes(route)) assert.equal(metadata(head, 'robots').length, 0);
    const image = await fetch(one(head, 'og:image'), {
      headers: { 'user-agent': agents[index % agents.length] },
    });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type')?.split(';')[0], one(head, 'og:image:type'));
    const actual = Buffer.from(await image.arrayBuffer());
    assert.deepEqual(actual, expectedBytes);
    const dimensions = await sharp(actual).metadata();
    assert.equal(dimensions.width, Number(one(head, 'og:image:width')));
    assert.equal(dimensions.height, Number(one(head, 'og:image:height')));
    console.log(`PASS SSR + public image: ${route}`);
  }
  for (const route of [
    `/viaturas/${vehicles[0].slug}/social-image?v=${'b'.repeat(64)}`,
    '/images/social/catalog-v1.jpg?marca=unknown-brand',
  ]) {
    const response = await fetch(origin + route);
    assert.ok([400, 404].includes(response.status), route);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  assert.ok(robots.includes('Allow: /'));
  for (const removed of ['/demo/porsche-911', '/demo/porsche-lab']) {
    const response = await fetch(origin + removed);
    assert.equal(response.status, 404, removed);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.ok(!(await response.text()).includes('auto-nunes-martins-miniatura.png'));
  }
  const sitemapResponse = await fetch(origin + '/sitemap.xml');
  assert.equal(sitemapResponse.status, 200);
  const sitemap = await sitemapResponse.text();
  for (const vehicle of vehicles) assert.ok(sitemap.includes(origin + '/viaturas/' + vehicle.slug));
  console.log(
    `Validated ${routes.length} routes, 4 crawler user agents, public images, canonical/JSON-LD consistency and staging noindex.`,
  );
} finally {
  child.kill();
  await new Promise((resolve) => api.close(resolve));
}
