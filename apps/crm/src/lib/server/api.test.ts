import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'https://api.example.test' }));
import { apiFetch, apiJson, ApiError, getApiToken } from './api';

function event(seconds = 60) {
  const getToken = vi.fn(async (options?: unknown) => options ? 'fresh-token' : 'request-token');
  const auth = { userId: 'user-1', sessionClaims: { exp: Math.floor(Date.now() / 1000) + seconds }, getToken };
  return {
    locals: { auth: () => auth },
    fetch: vi.fn(async () => Response.json({ items: [1] })),
    auth,
    getToken,
  };
}
afterEach(() => vi.useRealTimers());
describe('CRM authenticated server relay', () => {
  it('forwards only its verified token, omitting browser cookies and redirects', async () => {
    const e = event();
    await apiFetch(e as any, '/api/vehicles', { headers: { cookie: 'private', authorization: 'untrusted' } });
    const [url, init] = e.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/vehicles');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer request-token');
    expect(new Headers(init.headers).has('cookie')).toBe(false);
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'manual', cache: 'no-store' });
  });
  it('deduplicates near-expiry renewal within a request but never across sessions', async () => {
    const e = event(5);
    expect(await Promise.all([getApiToken(e as any), getApiToken(e as any)])).toEqual(['fresh-token', 'fresh-token']);
    expect(e.getToken).toHaveBeenCalledTimes(1);
    expect(e.getToken).toHaveBeenCalledWith({ expiresInSeconds: 60 });
    const other = event(5);
    await getApiToken(other as any);
    expect(other.getToken).toHaveBeenCalledTimes(1);
  });
  it('recovers a token rejected at the API boundary once for reads', async () => {
    const e = event();
    e.fetch.mockResolvedValueOnce(Response.json({ error: 'expired' }, { status: 401 }));
    expect((await apiFetch(e as any, '/api/vehicles')).status).toBe(200);
    expect(e.fetch).toHaveBeenCalledTimes(2);
    expect(e.getToken).toHaveBeenLastCalledWith({ expiresInSeconds: 60 });
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('never replays %s after an auth failure', async (method) => {
    const e = event();
    e.fetch.mockResolvedValue(Response.json({ error: 'expired' }, { status: 401 }));
    expect((await apiFetch(e as any, '/api/vehicles', { method, body: '{}' })).status).toBe(401);
    expect(e.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not fetch for a missing session or retry forbidden access', async () => {
    const e = event();
    e.auth.userId = null as any;
    expect((await apiFetch(e as any, '/api/me')).status).toBe(401);
    expect(e.fetch).not.toHaveBeenCalled();
    const denied = event();
    denied.fetch.mockResolvedValue(Response.json({ error: 'denied' }, { status: 403 }));
    expect((await apiFetch(denied as any, '/api/me')).status).toBe(403);
    expect(denied.fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps status and plain text for non-JSON errors without consuming the body twice', async () => {
    const e = event();
    e.fetch.mockResolvedValue(new Response('upstream unavailable', { status: 503 }));
    await expect(apiJson(e as any, '/api/me')).rejects.toMatchObject({
      name: 'ApiError', status: 503, body: 'upstream unavailable',
    });
  });
  it('does not turn an unauthorized read into an empty success', async () => {
    const e = event();
    e.fetch.mockImplementation(async () => Response.json({ error: 'expired' }, { status: 401 }));
    await expect(apiJson(e as any, '/api/vehicles')).rejects.toBeInstanceOf(ApiError);
    expect(e.fetch).toHaveBeenCalledTimes(2);
  });
  it('treats an upstream redirect as a failed API response instead of login data', async () => {
    const e = event();
    e.fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://elsewhere.test' } }));
    await expect(apiJson(e as any, '/api/me')).rejects.toMatchObject({ status: 502 });
    expect(e.fetch).toHaveBeenCalledTimes(1);
  });
});
