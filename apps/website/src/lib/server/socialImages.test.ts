import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./publicVehicles', () => ({ publicRequest: vi.fn() }));
import { publicRequest } from './publicVehicles';
import { socialImageResponse } from './socialImages';
const mocked = vi.mocked(publicRequest);
const version = 'a'.repeat(64);
const request = new Request('https://example.test/image');
afterEach(() => vi.resetAllMocks());

it('rejects mismatched versions, non-images and oversized streams instead of caching them', async () => {
  for (const response of [
    new Response(new Uint8Array([255, 216]), {
      headers: { 'content-type': 'image/jpeg', 'x-social-photo-version': 'b'.repeat(64) },
    }),
    new Response('<html>error</html>', {
      headers: { 'content-type': 'text/html', 'x-social-photo-version': version },
    }),
    new Response(new Uint8Array(2_000_001), {
      headers: { 'content-type': 'image/jpeg', 'x-social-photo-version': version },
    }),
  ]) {
    mocked.mockResolvedValueOnce(response);
    const result = await socialImageResponse('/slug/social-image', request, version);
    expect(result.status).toBe(503);
    expect(result.headers.get('cache-control')).toBe('no-store');
  }
});
it('forwards a verified image or an authorized conditional response and retains revocation', async () => {
  mocked.mockResolvedValueOnce(
    new Response(new Uint8Array([255, 216, 255, 217]), {
      headers: { 'content-type': 'image/jpeg', 'x-social-photo-version': version },
    }),
  );
  const ok = await socialImageResponse('/slug/social-image', request, version);
  expect(ok.status).toBe(200);
  expect(ok.headers.get('cache-control')).toContain('must-revalidate');
  mocked.mockResolvedValueOnce(
    new Response(null, {
      status: 304,
      headers: { 'x-social-photo-version': version, etag: '"test"' },
    }),
  );
  expect(
    (
      await socialImageResponse(
        '/slug/social-image',
        new Request(request, { headers: { 'if-none-match': '"test"' } }),
        version,
      )
    ).status,
  ).toBe(304);
  mocked.mockResolvedValueOnce(new Response(null, { status: 404 }));
  const revoked = await socialImageResponse('/slug/social-image', request, version);
  expect(revoked.status).toBe(404);
  expect(revoked.headers.get('cache-control')).toBe('no-store');
});
