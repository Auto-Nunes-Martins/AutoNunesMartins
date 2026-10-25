import { afterEach, expect, it, vi } from 'vitest';
import { createPublicGallerySession } from './publicGallerySession';

const slug = 'car-012345abcdef';
const version = 'a'.repeat(64);
const vehicle = { slug, photos: [`/api/public/vehicles/${slug}/photos/0?v=${version}`] };
const src = `/viaturas/${slug}/photos/0?v=${version}`;
function setup() {
  vi.stubGlobal('location', new URL('http://localhost/viaturas/' + slug));
  const fetcher = vi.fn().mockImplementation(async () => new Response(new Blob(['pixels'], { type: 'image/webp' }), {
    headers: { 'content-type': 'image/webp', 'x-photo-version': version },
  }));
  vi.stubGlobal('fetch', fetcher);
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retained');
  const session = createPublicGallerySession(vehicle); session.attach();
  return { session, fetcher, revoke };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('downloads once, shares pending work and retains bytes without an expiry timer or width refetch', async () => {
  const { session, fetcher } = setup();
  const first = session.read(src + '&w=1280');
  const second = session.read(src + '&w=2560');
  expect(first).toBe(second);
  const copy = await first;
  expect(copy?.blob.size).toBe(6);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]![0].href).toBe('http://localhost' + src + '&w=1600');
  expect(fetcher.mock.calls[0]![1].cache).toBe('only-if-cached');
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 365 * 86400000);
  expect(await session.read(src)).toBe(copy);
  expect(fetcher).toHaveBeenCalledTimes(1);
  session.detach();
});

it('keeps a discarded local copy unavailable without any replacement download', async () => {
  const { session, fetcher, revoke } = setup();
  await session.read(src);
  session.discard(src);
  expect(await session.read(src)).toBeUndefined();
  expect(await session.read(src + '&w=1600')).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(revoke).toHaveBeenCalledWith('blob:retained');
  session.detach();
});

it('cleans up only when the last gallery/viewer detaches and never downloads after disposal', async () => {
  const { session, fetcher, revoke } = setup();
  session.attach();
  const copy = await session.read(src);
  session.detach();
  expect(revoke).not.toHaveBeenCalled();
  expect(await session.read(src)).toBe(copy);
  session.detach();
  expect(revoke).toHaveBeenCalledOnce();
  expect(await session.read(src)).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('does not retry a failed first acquisition or seed, or request a URL outside current approved data', async () => {
  const { session, fetcher } = setup();
  const seed = vi.fn().mockResolvedValue(undefined);
  expect(await session.read(src, seed)).toBeUndefined();
  expect(await session.read(src)).toBeUndefined();
  expect(await session.read(src.replace(version, 'b'.repeat(64)))).toBeUndefined();
  expect(await session.read('https://private.example/image')).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
  expect(seed).toHaveBeenCalledOnce();
  session.detach();
});

it('uses the newly supplied identity on a new visit instead of the old photo bytes', async () => {
  const { session, fetcher } = setup();
  await session.read(src);
  session.detach();
  const nextVersion = 'b'.repeat(64);
  const next = createPublicGallerySession({ slug, photos: [vehicle.photos[0]!.replace(version, nextVersion)] });
  next.attach();
  fetcher.mockImplementationOnce(async () => new Response('replacement', {
    headers: { 'content-type': 'image/webp', 'x-photo-version': nextVersion },
  }));
  const copy = await next.read(src.replace(version, nextVersion));
  expect(await copy?.blob.text()).toBe('replacement');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]![0].href).toContain('v=' + nextVersion);
  next.detach();
});

it('makes one authorized fixed-width download after a browser cache miss, then never retries it', async () => {
  const { session, fetcher } = setup();
  fetcher.mockResolvedValueOnce(new Response(null, { status: 504 }));
  const copy = await session.read(src);
  expect(copy?.blob.size).toBe(6);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]![0].href).toBe('http://localhost' + src + '&w=1600');
  expect(fetcher.mock.calls[1]![1].cache).toBe('no-store');
  expect(await session.read(src)).toBe(copy);
  expect(fetcher).toHaveBeenCalledTimes(2);
  session.detach();
});

it('shares warmed thumbnail bytes with the gallery only for the freshly approved identity', async () => {
  const { session, fetcher } = setup();
  const { warmNavigationThumbnails, createThumbnailSession, cancelNavigationThumbnails } = await import('./publicThumbnail');
  fetcher.mockImplementation(async (url: string) => String(url).endsWith('/access')
    ? Response.json({ versions: [version] })
    : new Response(new Blob(['shared pixels'], { type: 'image/webp' }), {
      headers: { 'content-type': 'image/webp', 'x-photo-version': version },
    }));
  warmNavigationThumbnails(slug, 390, 3, 1);
  await createThumbnailSession(slug).prepared(0);
  const count = fetcher.mock.calls.length;
  expect(await (await session.read(src))?.blob.text()).toBe('shared pixels');
  expect(await session.read(src.replace(version, 'f'.repeat(64)))).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(count);
  session.detach();
  cancelNavigationThumbnails();
});
