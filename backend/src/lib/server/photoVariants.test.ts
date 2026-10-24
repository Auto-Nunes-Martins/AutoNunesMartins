import { beforeEach, describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
const mock = vi.hoisted(() => ({
  objects: new Map<string, { buffer: Buffer; type: string }>(),
  failWidth: 0,
  uploads: [] as string[],
  downloads: [] as string[],
}));
vi.mock('../data/storage.js', () => ({
  getBucketName: () => 'private',
  getSupabase: () => ({
    storage: {
      from: () => ({
        download: async (path: string) => {
          mock.downloads.push(path);
          const o = mock.objects.get(path);
          return o
            ? { data: new Blob([new Uint8Array(o.buffer)], { type: o.type }), error: null }
            : { data: null, error: { statusCode: 404 } };
        },
        info: async (path: string) => ({ data: mock.objects.has(path) ? {} : null, error: null }),
        upload: async (path: string, buffer: Buffer, options: { contentType: string }) => {
          mock.uploads.push(path);
          if (path.endsWith('/' + mock.failWidth + '.webp')) return { error: new Error('fixture') };
          mock.objects.set(path, { buffer: Buffer.from(buffer), type: options.contentType });
          return { error: null };
        },
      }),
    },
  }),
}));
import {
  buildPhotoVariants,
  ensurePhotoVariants,
  forgetPhotoVariants,
  manifestPath,
  readPhotoBytes,
  readVariantManifest,
  variantPath,
  variantRoot,
  preferredVariantPath,
  PHOTO_ENCODING_VERSION,
} from './photoVariants';
const path = 'cabcdefghijklmnopqrstuvwx/12345678-1234-1234-1234-123456789abc.jpg';
beforeEach(() => {
  mock.objects.clear();
  mock.uploads = [];
  mock.downloads = [];
  mock.failWidth = 0;
  forgetPhotoVariants(path);
});
describe('private reusable photo variants', () => {
  it('downloads one pixel file for concurrent requests and retains the warm result', async () => {
    const buffer = Buffer.from('shared-photo');
    mock.objects.set(path, { buffer, type: 'image/jpeg' });
    const photos = await Promise.all(Array.from({ length: 12 }, () => readPhotoBytes(path, 320)));
    expect(photos.every((photo) => photo?.buffer.equals(buffer))).toBe(true);
    expect(mock.downloads.filter((download) => download === path)).toHaveLength(1);
    await readPhotoBytes(path, 320);
    expect(mock.downloads.filter((download) => download === path)).toHaveLength(1);
  });
  it('retries a shared failed pixel download instead of retaining a failed promise', async () => {
    const photos = await Promise.all(Array.from({ length: 4 }, () => readPhotoBytes(path, 320)));
    expect(photos).toEqual([null, null, null, null]);
    mock.objects.set(path, { buffer: Buffer.from('recovered'), type: 'image/jpeg' });
    expect((await readPhotoBytes(path, 320))?.buffer.toString()).toBe('recovered');
    expect(mock.downloads.filter((download) => download === path)).toHaveLength(2);
  });
  it('does not retain pixels from an invalidated in-flight download', async () => {
    mock.objects.set(path, { buffer: Buffer.from('old'), type: 'image/jpeg' });
    const pending = readPhotoBytes(path, 320);
    forgetPhotoVariants(path);
    await pending;
    mock.objects.set(path, { buffer: Buffer.from('new'), type: 'image/jpeg' });
    expect((await readPhotoBytes(path, 320))?.buffer.toString()).toBe('new');
    expect(mock.downloads.filter((download) => download === path)).toHaveLength(2);
  });
  it('reports cold storage and warm pixel-cache timings without changing the delivered bytes', async () => {
    const buffer = Buffer.from('photo-fixture');
    mock.objects.set(path, { buffer, type: 'image/jpeg' });
    const timing = vi.fn();
    const cold = await readPhotoBytes(path, 320, timing);
    expect(cold?.buffer.equals(buffer)).toBe(true);
    expect(timing.mock.calls.map(([stage]) => stage)).toEqual([
      'photo-cache-miss',
      'photo-manifest',
      'photo-storage',
    ]);
    expect(timing.mock.calls.every(([, ms]) => Number.isFinite(ms) && ms >= 0)).toBe(true);
    const downloads = mock.downloads.length;
    timing.mockClear();
    const warm = await readPhotoBytes(path, 320, timing);
    expect(warm?.buffer.equals(buffer)).toBe(true);
    expect(timing.mock.calls).toEqual([['photo-cache-hit', 0]]);
    expect(mock.downloads).toHaveLength(downloads);
  });
  it('shares concurrent missing-manifest reads, caches legacy misses and invalidates explicitly', async () => {
    await Promise.all(Array.from({ length: 10 }, () => readVariantManifest(path)));
    expect(mock.downloads).toEqual([manifestPath(path)]);
    const clock = vi.spyOn(Date, 'now');
    const now = Date.now();
    try {
      clock.mockReturnValue(now + 30_000);
      await readVariantManifest(path);
      expect(mock.downloads).toHaveLength(1);
      forgetPhotoVariants(path);
      await readVariantManifest(path);
      expect(mock.downloads).toHaveLength(2);
      clock.mockReturnValue(now + 91_000);
      await readVariantManifest(path);
      expect(mock.downloads).toHaveLength(3);
    } finally {
      clock.mockRestore();
    }
  });
  it('does not repopulate the cache with a read invalidated during download', async () => {
    const pending = readVariantManifest(path);
    forgetPhotoVariants(path);
    await pending;
    await readVariantManifest(path);
    expect(mock.downloads).toHaveLength(2);
  });
  it('retains immutable manifests beyond a minute and refreshes after their TTL', async () => {
    const input = await sharp({
      create: { width: 400, height: 300, channels: 3, background: 'blue' },
    })
      .jpeg()
      .toBuffer();
    await ensurePhotoVariants(path, input);
    const before = mock.downloads.length;
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now');
    try {
      clock.mockReturnValue(now + 61_000);
      expect(await readVariantManifest(path)).not.toBeNull();
      expect(mock.downloads).toHaveLength(before);
      clock.mockReturnValue(now + 41 * 60_000);
      expect(await readVariantManifest(path)).not.toBeNull();
      expect(mock.downloads).toHaveLength(before + 1);
    } finally {
      clock.mockRestore();
    }
  });
  it('rejects unsafe/nested namespaces', () => {
    for (const p of ['../a.jpg', 'owner/../a.jpg', 'owner/.variants/a.jpg', 'a.jpg'])
      expect(() => variantRoot(p)).toThrow();
  });
  it('preserves the master, proportions and small native resolution', async () => {
    const input = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: '#7a8390' },
    })
      .jpeg({ quality: 98 })
      .toBuffer();
    const copy = Buffer.from(input);
    const result = await buildPhotoVariants(input);
    expect(input.equals(copy)).toBe(true);
    expect(result.manifest.variants.map((v) => v.width)).toEqual([320, 384, 800]);
    expect(result.manifest.variants.map((v) => v.height)).toEqual([213, 256, 533]);
    expect((await buildPhotoVariants(await sharp(input).resize(200).toBuffer())).files).toEqual([]);
  });
  it('auto-orients EXIF and strips location/EXIF from derivatives', async () => {
    const input = await sharp({
      create: { width: 1600, height: 1000, channels: 3, background: 'red' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await buildPhotoVariants(input);
    expect(result.manifest.width).toBe(1000);
    expect(result.manifest.height).toBe(1600);
    const meta = await sharp(result.files[0]!.buffer).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(512);
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
  });
  it('publishes manifest last, retries interrupted runs and reuses complete versions', async () => {
    const input = await sharp({
      create: { width: 1700, height: 1000, channels: 3, background: 'blue' },
    })
      .png()
      .toBuffer();
    mock.objects.set(path, { buffer: input, type: 'image/png' });
    mock.failWidth = 800;
    await expect(ensurePhotoVariants(path, input)).rejects.toThrow();
    expect(mock.objects.has(manifestPath(path))).toBe(false);
    expect(mock.objects.get(path)!.buffer.equals(input)).toBe(true);
    mock.failWidth = 0;
    const result = await ensurePhotoVariants(path, input);
    expect(result.created).toBe(5);
    expect(mock.uploads.at(-1)).toBe(manifestPath(path));
    const count = mock.uploads.length;
    forgetPhotoVariants(path);
    expect((await ensurePhotoVariants(path, input)).reused).toBe(true);
    expect(mock.uploads).toHaveLength(count);
    mock.objects.delete(variantPath(path, 800));
    expect((await ensurePhotoVariants(path, input)).reused).toBe(false);
  });
  it('falls back to originals for legacy photos and missing derivatives; keeps ETags content-specific', async () => {
    const input = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: 'green' },
    })
      .jpeg()
      .toBuffer();
    mock.objects.set(path, { buffer: input, type: 'image/jpeg' });
    const legacy = await readPhotoBytes(path, 320);
    expect(legacy!.buffer.equals(input)).toBe(true);
    await ensurePhotoVariants(path, input);
    const variant = await readPhotoBytes(path, 320);
    expect((await sharp(variant!.buffer).metadata()).width).toBe(320);
    expect(variant!.etag).not.toBe(legacy!.etag);
    forgetPhotoVariants(path);
    mock.objects.delete(variantPath(path, 320));
    expect((await readPhotoBytes(path, 320))!.buffer.equals(input)).toBe(true);
  });
  it('selects small high-density thumbnails and intermediate cards without changing the master', async () => {
    const input = await sharp({
      create: { width: 1800, height: 1200, channels: 3, background: '#254253' },
    })
      .jpeg()
      .toBuffer();
    mock.objects.set(path, { buffer: input, type: 'image/jpeg' });
    await ensurePhotoVariants(path, input);
    expect(await preferredVariantPath(path, 336)).toBe(variantPath(path, 384));
    expect(await preferredVariantPath(path, 1074)).toBe(variantPath(path, 1280));
    expect(mock.objects.get(path)!.buffer.equals(input)).toBe(true);
  });
  it('upgrades complete older recipes rather than silently reusing their compression', async () => {
    const input = await sharp({
      create: { width: 1000, height: 700, channels: 3, background: '#385b61' },
    })
      .jpeg()
      .toBuffer();
    const built = await ensurePhotoVariants(path, input);
    const old = { ...built.manifest, encodingVersion: undefined };
    const encoded = Buffer.from(JSON.stringify(old)).toString('base64');
    const sidecar = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#fff' },
    })
      .webp({ lossless: true })
      .withXmp(
        `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:anm="urn:anm:photo-variants:v1"><anm:manifest>${encoded}</anm:manifest></rdf:Description></rdf:RDF></x:xmpmeta>`,
      )
      .toBuffer();
    mock.objects.set(manifestPath(path), { buffer: sidecar, type: 'image/webp' });
    forgetPhotoVariants(path);
    const upgraded = await ensurePhotoVariants(path, input);
    expect(upgraded.reused).toBe(false);
    expect(upgraded.manifest.encodingVersion).toBe(PHOTO_ENCODING_VERSION);
    expect(mock.uploads.at(-1)).toBe(manifestPath(path));
  });
});
