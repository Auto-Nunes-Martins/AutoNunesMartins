import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});
const versions = Array.from({ length: 12 }, (_, index) => index.toString(16).padStart(64, '0'));
const image = (index: number) =>
  new Response(new Blob(['pixels'], { type: 'image/webp' }), {
    headers: { 'x-photo-version': versions[index]! },
  });

it('gives the viewer a cache-only session using identities already supplied by this page', async () => {
  const request = vi.fn();
  vi.stubGlobal('fetch', request);
  const module = await import('./publicThumbnail');
  const session = module.createThumbnailSession('car-abcdef123456', versions, true);
  session.attach();
  expect(session.cacheOnly).toBe(true);
  expect(session.hasPixels()).toBe(true);
  expect(await session.access()).toEqual(versions);
  expect(request).not.toHaveBeenCalled();
  session.detach();
});

it('selects a coherent gallery group from the detail slot and density', async () => {
  const { navigationThumbnailWidth } = await import('./publicThumbnail');
  expect(navigationThumbnailWidth(1400, 1)).toBe(1280);
  expect(navigationThumbnailWidth(390, 2)).toBe(800);
  expect(navigationThumbnailWidth(390, 3)).toBe(1280);
  expect(navigationThumbnailWidth(1400, 4)).toBe(2560);
  expect(navigationThumbnailWidth(1400, 8)).toBe(2560);
});

it.each([390, 1400])(
  'prepares every photo at viewport %s while retaining the same file identity',
  async (viewport) => {
    const request = vi.fn(async (url: string) =>
      url.endsWith('/access')
        ? Response.json({ versions })
        : image(Number(url.match(/photos\/(\d+)/)![1])),
    );
    vi.stubGlobal('fetch', request);
    const module = await import('./publicThumbnail');
    module.warmNavigationThumbnails('car-abcdef123456', viewport, 3);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(13));
    const urls = request.mock.calls.map(([url]) => url).filter((url) => !url.endsWith('/access'));
    expect(urls).toHaveLength(12);
    const chosen=module.navigationThumbnailWidth(viewport,3);expect(urls.every((url)=>url.endsWith('&w='+chosen))).toBe(true);
    module.cancelNavigationThumbnails();
  },
);

it('starts only explicitly, queues all photos with six concurrent downloads, then reuses pixels with fresh access', async () => {
  const releases: Array<() => void> = [];
  let current = 0,
    peak = 0;
  const request = vi.fn(async (url: string) => {
    if (url.endsWith('/access')) return Response.json({ versions });
    current++;
    peak = Math.max(peak, current);
    const index = Number(url.match(/photos\/(\d+)/)![1]);
    await new Promise<void>((resolve) => releases.push(resolve));
    current--;
    return image(index);
  });
  vi.stubGlobal('fetch', request);
  const module = await import('./publicThumbnail');
  expect(request).not.toHaveBeenCalled();
  module.warmNavigationThumbnails('car-abcdef123456', 1400, 1);
  await vi.waitFor(() => expect(releases).toHaveLength(6));
  const session = module.createThumbnailSession('car-abcdef123456');
  expect(session.hasPixels()).toBe(true);
  session.attach();
  await session.access();
  expect(request.mock.calls.filter(([url]) => url.endsWith('/access'))).toHaveLength(2);
  for (const count of [12]) {
    releases.forEach((resolve) => resolve());
    await vi.waitFor(() => expect(releases).toHaveLength(count));
  }
  releases.forEach((resolve) => resolve());
  await session.prepared(11);
  expect(peak).toBe(6);
  const urls = request.mock.calls.map(([url]) => url).filter((url) => !url.endsWith('/access'));
  expect(urls).toHaveLength(12);
  expect(urls.every((url) => /\?v=[a-f0-9]{64}&w=1280$/.test(url))).toBe(true);
  expect(module.createThumbnailSession('car-abcdef123456').hasPixels()).toBe(true);
  session.detach();
  module.cancelNavigationThumbnails();
});

it('cancels abandoned navigation without starting queued photos or retaining incomplete pixels', async () => {
  const signals: AbortSignal[] = [];
  const request = vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/access')) return Response.json({ versions });
    signals.push(options.signal as AbortSignal);
    await new Promise((_resolve, reject) =>
      options.signal!.addEventListener('abort', () => reject(Error('cancelled'))),
    );
    return image(0);
  });
  vi.stubGlobal('fetch', request);
  const module = await import('./publicThumbnail');
  module.warmNavigationThumbnails('car-abcdef123456', 1200, 1);
  await vi.waitFor(() => expect(signals).toHaveLength(6));
  const session = module.createThumbnailSession('car-abcdef123456');
  module.cancelNavigationThumbnails();
  await session.prepared(8);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
  expect(request).toHaveBeenCalledTimes(7);
  expect(module.createThumbnailSession('car-abcdef123456').hasPixels()).toBe(false);
});

it('falls back without retaining permission when the access request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  const module = await import('./publicThumbnail');
  module.warmNavigationThumbnails('car-abcdef123456', 1200, 1);
  await vi.waitFor(() =>
    expect(module.createThumbnailSession('car-abcdef123456').hasPixels()).toBe(false),
  );
  module.cancelNavigationThumbnails();
});

it('does not download from a stale card count when current access fails', async () => {
  const request = vi.fn(async (_url: string) => new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', request);
  const module = await import('./publicThumbnail');
  module.warmNavigationThumbnails('car-abcdef123456', 390, 3, 2);
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const session = module.createThumbnailSession('car-abcdef123456');
  session.attach();
  await expect(session.access()).rejects.toThrow('Photos unavailable');
  expect(request.mock.calls.every(([url]) => String(url).endsWith('/photos/access'))).toBe(true);
  session.detach();
  module.cancelNavigationThumbnails();
});

it.each([-1, 21, 1.5, NaN])('discovers a safe count for an invalid hint %s', async (count) => {
  const request = vi.fn().mockResolvedValue(Response.json({ versions: [] }));
  vi.stubGlobal('fetch', request);
  const module = await import('./publicThumbnail');
  module.warmNavigationThumbnails('car-abcdef123456', 1200, 1, count);
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(request.mock.calls[0]?.[0]).toContain('/photos/access');
  module.cancelNavigationThumbnails();
});
