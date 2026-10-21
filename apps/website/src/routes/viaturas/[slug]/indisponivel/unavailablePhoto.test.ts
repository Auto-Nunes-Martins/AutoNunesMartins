import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('$lib/server/publicVehicles', () => ({ publicRequest: mock.request }));
import { GET } from './foto/+server';
const slug = 'bmw-2019-012345abcdef';
const read = (value = slug, headers: Record<string, string> = {}) =>
  GET({
    params: { slug: value },
    request: new Request('http://localhost/photo', { headers }),
  } as Parameters<typeof GET>[0]);
afterEach(() => vi.resetAllMocks());
describe('unavailable vehicle photo BFF', () => {
  it('serves a bounded WebP with mandatory private revalidation', async () => {
    mock.request.mockResolvedValue(
      new Response('webp', { headers: { 'content-type': 'image/webp' } }),
    );
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe(
      'private, no-cache, max-age=0, must-revalidate',
    );
    expect(result.headers.get('etag')).toBeTruthy();
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(mock.request).toHaveBeenCalledWith(`/unavailable/${slug}/photo`);
  });
  it('reuses unchanged bytes, replaces changed photos and does not reuse removed photos', async () => {
    mock.request.mockImplementation(
      async () => new Response('first', { headers: { 'content-type': 'image/webp' } }),
    );
    const first = await read();
    const headers = { 'if-none-match': first.headers.get('etag')! };
    const cached = await read(slug, headers);
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe('');
    mock.request.mockResolvedValueOnce(
      new Response('second', { headers: { 'content-type': 'image/webp' } }),
    );
    const changed = await read(slug, headers);
    expect(changed.status).toBe(200);
    expect(await changed.text()).toBe('second');
    expect(changed.headers.get('etag')).not.toBe(headers['if-none-match']);
    mock.request.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const removed = await read(slug, headers);
    expect(removed.status).toBe(404);
    expect(removed.headers.get('cache-control')).toBe('no-store');
  });
  it.each([404, 503, 500])('keeps withdrawal 404 and real failure 503 for %i', async (status) => {
    mock.request.mockResolvedValue(new Response(null, { status }));
    expect((await read()).status).toBe(status === 404 ? 404 : 503);
  });
  it('rejects invalid slugs, content types and oversized responses with no private fallback', async () => {
    expect((await read('../private')).status).toBe(404);
    expect(mock.request).not.toHaveBeenCalled();
    mock.request
      .mockResolvedValueOnce(new Response('html', { headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array(2_000_001), { headers: { 'content-type': 'image/webp' } }),
      )
      .mockRejectedValueOnce(new Error('offline'));
    expect((await read()).status).toBe(503);
    expect((await read()).status).toBe(503);
    expect((await read()).status).toBe(503);
  });
});
