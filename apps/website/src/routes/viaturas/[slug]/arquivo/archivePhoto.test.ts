import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('$lib/server/publicVehicles', () => ({ publicRequest: mock.request }));
import { GET } from './foto/+server';
const slug = 'bmw-2019-012345abcdef';
const read = (value = slug) => GET({ params: { slug: value } } as Parameters<typeof GET>[0]);
afterEach(() => vi.resetAllMocks());
describe('archive photo BFF', () => {
  it('serves a bounded WebP through the public request helper, no-store', async () => {
    mock.request.mockResolvedValue(
      new Response('webp', { headers: { 'content-type': 'image/webp' } }),
    );
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(mock.request).toHaveBeenCalledWith(`/archive/${slug}/photo`);
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
        new Response(new Uint8Array(800_001), { headers: { 'content-type': 'image/webp' } }),
      )
      .mockRejectedValueOnce(new Error('offline'));
    expect((await read()).status).toBe(503);
    expect((await read()).status).toBe(503);
    expect((await read()).status).toBe(503);
  });
});
