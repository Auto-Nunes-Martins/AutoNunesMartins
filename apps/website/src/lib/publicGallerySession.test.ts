import { afterEach, expect, it, vi } from 'vitest';

const slug = 'car-012345abcdef';
const version = 'a'.repeat(64);
const vehicle = { slug, photos: [`/api/public/vehicles/${slug}/photos/0?v=${version}`] };
const src = `/viaturas/${slug}/photos/0?v=${version}`;
async function setup() {
  const { createPublicGallerySession } = await import('./publicGallerySession');
  vi.stubGlobal('location', new URL('http://localhost/viaturas/' + slug));
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(new Blob(['pixels'], { type: 'image/webp' }), {
        headers: { 'content-type': 'image/webp', 'x-photo-version': version },
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retained');
  const session = createPublicGallerySession(vehicle);
  session.attach();
  return { session, fetcher, revoke };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});
it('reuses an already sufficient larger candidate instead of downloading a smaller gallery copy', async () => {
  vi.stubGlobal('window', { innerWidth: 390, devicePixelRatio: 2 });
  const { session, fetcher } = await setup();
  (await import('./publicThumbnail')).remember(
    slug,
    version,
    1280,
    new Blob(['pixels'], { type: 'image/webp' }),
  );
  expect(await session.read(src)).toBeDefined();
  expect(session.width(src)).toBe(1280);
  expect(fetcher).not.toHaveBeenCalled();
  session.detach();
});
it('uses a coherent mobile group and upgrades an unknown wide crop without relabelling pixels', async () => {
  vi.stubGlobal('window', { innerWidth: 390, devicePixelRatio: 2 });
  const { session, fetcher } = await setup();
  const notify = vi.fn();
  session.subscribe(notify);
  await session.read(src);
  expect(fetcher.mock.calls[0]![0].searchParams.get('w')).toBe('800');
  expect(session.observe(src, 2)).toBe(true);
  expect(notify).toHaveBeenCalledOnce();
  await session.read(src);
  expect(fetcher.mock.calls[1]![0].searchParams.get('w')).toBe('1280');
  expect(session.width(src)).toBe(1280);
  session.detach();
});

it('downloads once, shares pending work and retains bytes without an expiry timer or width refetch', async () => {
  const { session, fetcher } = await setup();
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
  const { session, fetcher, revoke } = await setup();
  await session.read(src);
  session.discard(src);
  expect(await session.read(src)).toBeUndefined();
  expect(await session.read(src + '&w=1600')).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(revoke).toHaveBeenCalledWith('blob:retained');
  session.detach();
});

it('cleans up only when the last gallery/viewer detaches and never downloads after disposal', async () => {
  const { session, fetcher, revoke } = await setup();
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
  const { session, fetcher } = await setup();
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
  const { session, fetcher } = await setup();
  await session.read(src);
  session.detach();
  const nextVersion = 'b'.repeat(64);
  const next = (await import('./publicGallerySession')).createPublicGallerySession({
    slug,
    photos: [vehicle.photos[0]!.replace(version, nextVersion)],
  });
  next.attach();
  fetcher.mockImplementationOnce(
    async () =>
      new Response('replacement', {
        headers: { 'content-type': 'image/webp', 'x-photo-version': nextVersion },
      }),
  );
  const copy = await next.read(src.replace(version, nextVersion));
  expect(await copy?.blob.text()).toBe('replacement');
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]![0].href).toContain('v=' + nextVersion);
  next.detach();
});

it('makes one authorized fixed-width download after a browser cache miss, then never retries it', async () => {
  const { session, fetcher } = await setup();
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
  const { session, fetcher } = await setup();
  const { warmNavigationThumbnails, createThumbnailSession, cancelNavigationThumbnails } =
    await import('./publicThumbnail');
  fetcher.mockImplementation(async (url: string) =>
    String(url).endsWith('/access')
      ? Response.json({ versions: [version] })
      : new Response(new Blob(['shared pixels'], { type: 'image/webp' }), {
          headers: { 'content-type': 'image/webp', 'x-photo-version': version },
        }),
  );
  warmNavigationThumbnails(slug, 1400, 1.5, 1);
  await createThumbnailSession(slug).prepared(0);
  const count = fetcher.mock.calls.length;
  expect(await (await session.read(src))?.blob.text()).toBe('shared pixels');
  expect(await session.read(src.replace(version, 'f'.repeat(64)))).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(count);
  session.detach();
  cancelNavigationThumbnails();
});
