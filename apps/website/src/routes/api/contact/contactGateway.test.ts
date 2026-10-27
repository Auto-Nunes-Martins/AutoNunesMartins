import { contactBudgetFixture } from '../../../../../../backend/test/contactBudgetFixture';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicContactRouter } from '../../../../../../backend/src/routes/publicContact';

// Deployment is a separate native Node JS program (covered by node --test),
// not part of the Svelte application's TypeScript module graph.
const { createGateway } = await import(
  new URL('../../../../../../deployment/gateway.mjs', import.meta.url).href
);
const { config } = await import(
  new URL('../../../../../../deployment/routing.mjs', import.meta.url).href
);

const settings = vi.hoisted(() => ({
  env: {
    CONTACT_RELAY_SECRET: 'fixture-only-secret'.repeat(2),
    INTERNAL_BACKEND_URL: '',
  },
  readiness: { privacy: [{ value: null as string | null }] },
}));
vi.mock('$env/dynamic/private', () => ({ env: settings.env }));
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'http://127.0.0.1:9' }));
vi.mock('$lib/publicationReadiness.json', () => ({ default: settings.readiness }));
import { POST } from './+server';

const servers: Server[] = [];
const budgets: Awaited<ReturnType<typeof contactBudgetFixture>>[] = [];
async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as { port: number }).port;
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    ),
  );
  await Promise.all(budgets.splice(0).map((f) => f.db.close()));
  vi.restoreAllMocks();
});

async function setup(render = true, enabled = true) {
  const fixture = await contactBudgetFixture();
  budgets.push(fixture);
  const send = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => Response.json({ id: 'fixture-email' }));
  const app = express();
  app.use(express.json());
  const identities: string[] = [];
  app.use((_req, _res, next) => {
    identities.push(String(_req.headers['x-contact-client']));
    next();
  });
  app.use(
    '/api/public/contact',
    createPublicContactRouter(
      {
        enabled,
        apiKey: 'fixture-only-key',
        from: 'website@example.org',
        to: 'stand@example.org',
        relaySecret: settings.env.CONTACT_RELAY_SECRET,
      },
      send,
      fixture.store(),
    ),
  );
  const backend = await listen(createServer(app));
  settings.env.INTERNAL_BACKEND_URL = `http://127.0.0.1:${backend}`;
  // Adapter boundary fixture: ADDRESS_HEADER is forced by deployment/start.mjs;
  // upstream listener is loopback-only, just like adapter-node in production.
  const website = await listen(
    createServer(async (req, res) => {
      if (req.url !== '/api/contact') {
        res.end('fixture-page');
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const url = new URL('https://fixture.example/api/contact');
      const response = await POST({
        url,
        request: new Request(url, {
          method: 'POST',
          body: Buffer.concat(chunks),
          headers: { origin: String(req.headers.origin), 'content-type': 'application/json' },
        }),
        getClientAddress: () => {
          const value = req.headers['x-anm-client-address'];
          if (typeof value !== 'string') throw Error('missing adapter address');
          return value;
        },
      } as Parameters<typeof POST>[0]);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    }),
  );
  const gateway = await listen(
    createGateway(
      config({
        WEBSITE_ORIGIN: 'https://fixture.example',
        ...(render ? { RENDER: 'true', RENDER_SERVICE_TYPE: 'web' } : {}),
      }),
      { website, backend, crm: website },
      () => true,
      new Set(),
    ),
  );
  // Trusted-edge fixture supplies CF-Connecting-IP. Forged public headers are
  // separately passed below; the real Cloudflare overwrite requires deploy QA.
  const post = (
    ip: string | undefined,
    extra: Record<string, string> = {},
    path = '/api/contact',
  ) =>
    new Promise<number>((resolve, reject) => {
      const request = httpRequest(
        {
          hostname: '127.0.0.1',
          port: gateway,
          path,
          method: 'POST',
          headers: {
            host: 'fixture.example',
            origin: 'https://fixture.example',
            'content-type': 'application/json',
            ...extra,
            ...(ip ? { 'cf-connecting-ip': ip } : {}),
          },
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(response.statusCode!));
        },
      );
      request.on('error', reject);
      request.end(
        JSON.stringify({
          name: 'Fixture',
          email: 'visitor@example.org',
          subject: 'Fixture',
          message: 'No real email sent',
          page: '/',
          website: '',
          requestId: randomUUID(),
        }),
      );
    });
  return { post, send, identities, fixture };
}

describe('gateway → contact relay → real backend limiter (simulated email provider)', () => {
  it('isolates two visitors and rejects the sixth request despite spoofed forwarding/internal headers', async () => {
    const { post, send, identities } = await setup();
    for (let i = 0; i < 5; i++) {
      expect(
        await post('192.0.2.1', {
          'x-forwarded-for': `203.0.113.${i}`,
          'x-real-ip': `203.0.113.${i}`,
          'x-anm-client-address': `203.0.113.${i}`,
          'x-contact-client': String(i),
          'x-contact-relay': 'forged',
        }),
      ).toBe(202);
    }
    expect(await post('192.0.2.1', { 'x-forwarded-for': '203.0.113.99' })).toBe(429);
    expect(await post('192.0.2.2')).toBe(202);
    expect(new Set(identities.slice(0, 6)).size).toBe(1);
    expect(identities[6]).not.toBe(identities[0]);
    expect(identities[0]).toBe(
      createHmac('sha256', settings.env.CONTACT_RELAY_SECRET).update('192.0.2.1').digest('hex'),
    );
    expect(send).toHaveBeenCalledTimes(6);
    // Public requests cannot impersonate the internal relay directly.
    expect(await post('192.0.2.3', { 'x-contact-relay': 'forged' }, '/api/public/contact')).toBe(
      403,
    );
  });
  it('keeps the 20-attempt global limit across otherwise independent visitors', async () => {
    const { post, send } = await setup();
    for (let i = 1; i <= 20; i++) expect(await post(`192.0.2.${i}`)).toBe(202);
    expect(await post('192.0.2.21')).toBe(429);
    expect(send).toHaveBeenCalledTimes(20);
  });
  it('allows the same visitor again after the existing ten-minute window', async () => {
    const { post, send, fixture } = await setup();
    for (let i = 0; i < 5; i++) expect(await post('192.0.2.1')).toBe(202);
    expect(await post('192.0.2.1')).toBe(429);
    fixture.advance(10 * 60_000);
    expect(await post('192.0.2.1')).toBe(202);
    expect(send).toHaveBeenCalledTimes(6);
  });
  it('normalises equivalent IPv6 and mapped IPv4 identities', async () => {
    const { post, identities } = await setup();
    expect(await post('2001:db8::1')).toBe(202);
    expect(await post('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(202);
    expect(identities[0]).toBe(identities[1]);
    expect(await post('::ffff:192.0.2.1')).toBe(202);
    expect(await post('192.0.2.1')).toBe(202);
    expect(identities[2]).toBe(identities[3]);
  });
  it('fails closed on missing/malformed edge addresses without falling back to forged alternatives', async () => {
    const { post, send } = await setup();
    for (const ip of [undefined, 'invalid', '192.0.2.1, 192.0.2.2']) {
      expect(
        await post(ip, { 'x-forwarded-for': '192.0.2.1', 'x-anm-client-address': '192.0.2.1' }),
      ).toBe(503);
    }
    expect(await post(undefined, {}, '/')).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
  it('ignores even CF headers on a direct local deployment', async () => {
    const { post, identities } = await setup(false);
    expect(await post('192.0.2.1')).toBe(202);
    expect(await post('192.0.2.2')).toBe(202);
    expect(identities[0]).toBe(identities[1]);
  });
  it('retains the independent backend sending switch', async () => {
    const { post, send } = await setup(true, false);
    expect(await post('192.0.2.1')).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });
});
