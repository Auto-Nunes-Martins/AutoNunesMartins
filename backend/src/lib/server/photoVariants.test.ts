import { beforeEach, describe, it, expect, vi } from 'vitest';
import sharp from 'sharp';
const mock = vi.hoisted(() => ({
  objects: new Map<string, { buffer: Buffer; type: string }>(),
  failWidth: 0,
  uploads: [] as string[],
}));
vi.mock('../data/storage.js', () => ({
  getBucketName: () => 'private',
  getSupabase: () => ({
    storage: {
      from: () => ({
        download: async (path: string) => {
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
  variantPath,
  variantRoot,
} from './photoVariants';
const path = 'cabcdefghijklmnopqrstuvwx/12345678-1234-1234-1234-123456789abc.jpg';
beforeEach(() => {
  mock.objects.clear();
  mock.uploads = [];
  mock.failWidth = 0;
  forgetPhotoVariants(path);
});
describe('private reusable photo variants', () => {
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
    expect(result.manifest.variants.map((v) => v.width)).toEqual([320, 800]);
    expect(result.manifest.variants.map((v) => v.height)).toEqual([213, 533]);
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
    expect(result.created).toBe(3);
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
});
