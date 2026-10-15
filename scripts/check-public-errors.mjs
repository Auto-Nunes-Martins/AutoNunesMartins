// Run after the Node website build with --conditions=anm-runtime.
// Exercises SvelteKit's real production error renderer with an isolated API fixture.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server } from '../apps/website/.svelte-kit/output/server/index.js';
import { manifest } from '../apps/website/.svelte-kit/output/server/manifest.js';

const privateMarker = 'PRIVATE_UNEXPECTED_ERROR_FIXTURE_NEVER_RENDER';
const api = createServer((request, response) => {
  response.writeHead(request.url.includes('unavailable-') ? 503 : 404, {
    'content-type': 'application/json',
  });
  response.end(JSON.stringify({ error: 'PRIVATE_BACKEND_FIXTURE_NEVER_RENDER' }));
});
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const index = manifest._.nodes.length;
const fixtureManifest = {
  ...manifest,
  _: {
    ...manifest._,
    nodes: [
      ...manifest._.nodes,
      async () => ({
        index,
        server_id: 'in-memory-test-fixture',
        server: {
          load: () => {
            throw new Error(privateMarker);
          },
        },
        imports: [],
        stylesheets: [],
        fonts: [],
      }),
    ],
    routes: [
      {
        id: '/__unexpected_fixture',
        pattern: /^\/__unexpected_fixture\/?$/,
        params: [],
        page: { layouts: [0], errors: [1], leaf: index },
        endpoint: null,
      },
      ...manifest._.routes,
    ],
  },
};
const server = new Server(fixtureManifest);
await server.init({
  env: {
    NODE_ENV: 'production',
    SITE_NOINDEX: 'false',
    INTERNAL_BACKEND_URL: `http://127.0.0.1:${api.address().port}`,
  },
});
const logError = console.error;
console.error = (...args) => {
  if (args.some((value) => String(value).includes(privateMarker))) return;
  logError(...args);
};
try {
  for (const [path, status, title, heading] of [
    ['/pagina-inexistente', 404, 'Página não encontrada', 'Este caminho não está por aqui.'],
    [
      '/viaturas/missing-abcdef123456',
      404,
      'Viatura não disponível',
      'Esta viatura não está publicada.',
    ],
    [
      '/viaturas/unavailable-abcdef123456',
      503,
      'Temporariamente indisponível',
      'Esta ficha está temporariamente indisponível.',
    ],
    [
      '/__unexpected_fixture',
      500,
      'Não foi possível abrir a página',
      'Algo não correu como esperado.',
    ],
  ]) {
    const response = await server.respond(
      new Request(`https://website.example${path}`, { headers: { accept: 'text/html' } }),
      { getClientAddress: () => '127.0.0.1' },
    );
    const html = await response.text();
    assert.equal(response.status, status, path);
    assert.ok(html.includes(`<title>${title} — Auto Nunes Martins</title>`), path);
    assert.ok(html.includes(heading), path);
    assert.ok(
      !html.includes(privateMarker) && !html.includes('PRIVATE_BACKEND_FIXTURE_NEVER_RENDER'),
      'internal error details must stay out of HTML',
    );
    const main = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1];
    assert.ok(
      main?.includes('href="/"') && main.includes('href="/viaturas"'),
      'error page recovery links',
    );
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((html.match(/name="robots"/g) || []).length, 1);
    assert.ok(
      !html.includes('application/ld+json'),
      'error pages must not publish vehicle structured data',
    );
    if (status === 503) assert.equal(response.headers.get('retry-after'), '120');
    console.log(`PASS production HTML/status ${status}: ${path}`);
  }
} finally {
  console.error = logError;
  api.closeAllConnections();
  await new Promise((resolve) => api.close(resolve));
}
