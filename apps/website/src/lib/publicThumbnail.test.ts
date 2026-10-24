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

it('selects a thumbnail matching the same responsive sizes without reducing dense-screen resolution', async () => {
  const { navigationThumbnailWidth } = await import('./publicThumbnail');
  expect(navigationThumbnailWidth(1400, 1)).toBe(320);
  expect(navigationThumbnailWidth(390, 3)).toBe(384);
  expect(navigationThumbnailWidth(1400, 4)).toBe(800);
  expect(navigationThumbnailWidth(1400, 8)).toBe(1280);
});

it('starts only explicitly, limits work to nine photos and six concurrent downloads, then reuses pixels with fresh access', async () => {
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
  module.warmNavigationThumbnails('car-abcdef123456', 390, 3);
  await vi.waitFor(() => expect(releases).toHaveLength(6));
  const session = module.createThumbnailSession('car-abcdef123456');
  expect(session.hasPixels()).toBe(true);
  session.attach();
  await session.access();
  expect(request.mock.calls.filter(([url]) => url.endsWith('/access'))).toHaveLength(2);
  for (const count of [9]) {
    releases.forEach((resolve) => resolve());
    await vi.waitFor(() => expect(releases).toHaveLength(count));
  }
  releases.forEach((resolve) => resolve());
  await session.prepared(8);
  expect(peak).toBe(6);
  const urls = request.mock.calls.map(([url]) => url).filter((url) => !url.endsWith('/access'));
  expect(urls).toHaveLength(9);
  expect(urls.every((url) => url.endsWith('?w=384'))).toBe(true);
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
