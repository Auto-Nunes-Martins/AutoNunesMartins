import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const settings = vi.hoisted(() => ({
  env: { CONTACT_RELAY_SECRET: 's'.repeat(32) },
  readiness: { privacy: [{ value: null as string | null }] },
}));
vi.mock('$env/dynamic/private', () => ({ env: settings.env }));
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'https://backend.example.org' }));
vi.mock('$lib/publicationReadiness.json', () => ({ default: settings.readiness }));
import { POST } from './+server';

async function post(body = '{}', origin = 'https://site.example.org', address = () => '192.0.2.1') {
  return POST({
    request: new Request('https://site.example.org/api/contact', {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json', cookie: 'private-session=secret' },
      body,
    }),
    url: new URL('https://site.example.org/api/contact'),
    getClientAddress: address,
  } as Parameters<typeof POST>[0]);
}
beforeEach(() => {
  settings.env.CONTACT_RELAY_SECRET = 's'.repeat(32);
  settings.readiness.privacy[0]!.value = null;
});
afterEach(() => vi.unstubAllGlobals());
describe('contact relay', () => {
  it('fails closed without a valid adapter client address', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    expect((await post('{}', undefined, () => 'invalid')).status).toBe(503);
    expect(
      (
        await post('{}', undefined, () => {
          throw Error('missing address');
        })
      ).status,
    ).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });
  it('forwards with pending privacy metadata and no privacy environment prerequisite', async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 202 }));
    vi.stubGlobal('fetch', send);
    expect(settings.readiness.privacy[0]!.value).toBeNull();
    expect((await post()).status).toBe(202);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('fails closed when relay credentials are missing', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    settings.env.CONTACT_RELAY_SECRET = '';
    expect((await post()).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
  });
  it('rejects another origin and oversized bodies before forwarding', async () => {
    const send = vi.fn();
    vi.stubGlobal('fetch', send);
    expect((await post('{}', 'https://attacker.example.org')).status).toBe(403);
    expect((await post('not-json')).status).toBe(400);
    expect((await post('x'.repeat(16_385))).status).toBe(413);
    expect(send).not.toHaveBeenCalled();
  });
  it('forwards to the backend with private relay authentication and a derived client identifier', async () => {
    const send = vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 202 }));
    vi.stubGlobal('fetch', send);
    const response = await post();
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    const [url, init] = send.mock.calls[0]!;
    expect(String(url)).toBe('https://backend.example.org/api/public/contact');
    expect(init.headers['x-contact-relay']).toBe(settings.env.CONTACT_RELAY_SECRET);
    expect(init.headers['x-contact-client']).toMatch(/^[a-f0-9]{64}$/);
    expect(init.headers.cookie).toBeUndefined();
    expect(init.credentials).toBe('omit');
  });
  it('does not report success when the backend rejects or times out', async () => {
    const send = vi
      .fn()
      .mockResolvedValue(Response.json({ error: 'Indisponível' }, { status: 503 }));
    vi.stubGlobal('fetch', send);
    expect((await post()).status).toBe(503);
    send.mockRejectedValue(new Error('private backend diagnostic'));
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private backend diagnostic');
  });
});
