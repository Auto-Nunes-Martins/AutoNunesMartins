import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('$lib/server/publicVehicles', () => ({ publicRequest: mock.request }));
import { GET } from './[index]/+server';
const read = () =>
  GET({
    params: { slug: 'dacia-jogger-abcdef123456', index: '0' },
    url: new URL('http://localhost/viaturas/dacia-jogger-abcdef123456/photos/0?w=320'),
    request: new Request('http://localhost/photo'),
  } as Parameters<typeof GET>[0]);
afterEach(() => vi.resetAllMocks());
describe('public photo diagnostics', () => {
  it.each([200, 304])(
    'preserves numeric timings on %i without changing cache policy or image bytes',
    async (status) => {
      const timing = 'photo-check;dur=12.3, photo-cache-hit;dur=0.0, photo-total;dur=12.4';
      mock.request.mockResolvedValue(
        new Response(status === 200 ? 'photo-bytes' : null, {
          status,
          headers: { 'content-type': 'image/webp', 'server-timing': timing, etag: '"photo"' },
        }),
      );
      const result = await read();
      expect(result.status).toBe(status);
      expect(result.headers.get('server-timing')).toBe(timing);
      expect(result.headers.get('cache-control')).toBe(
        'private, no-cache, max-age=0, must-revalidate',
      );
      expect(await result.text()).toBe(status === 200 ? 'photo-bytes' : '');
    },
  );
  it.each([
    'database;desc="private-host"',
    'photo-check;dur=1.2, sql;desc="secret"',
    'photo-check;dur=NaN',
    'photo-check;dur=1.2;desc="private-path"',
  ])('does not expose arbitrary diagnostic metadata: %s', async (timing) => {
    mock.request.mockResolvedValue(
      new Response('photo-bytes', {
        headers: { 'content-type': 'image/webp', 'server-timing': timing },
      }),
    );
    const result = await read();
    expect(result.headers.get('server-timing')).toBeNull();
    expect(await result.text()).toBe('photo-bytes');
  });
});
