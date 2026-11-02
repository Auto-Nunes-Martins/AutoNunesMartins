import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { sanitizePhotoMetadata } from './photoMetadata.js';
import { optimizePhoto } from './photoOptimization.js';
import webpFixtures from './__fixtures__/photoMetadataWebp.json';

async function fixture(format: 'jpeg' | 'png' | 'webp', orientation = 1) {
  const raw = Buffer.from(Array.from({ length: 48 * 32 * 3 }, (_, i) => (i * 37) % 256));
  return sharp(raw, { raw: { width: 48, height: 32, channels: 3 } })
    .toFormat(format, { quality: 90, progressive: true })
    .withMetadata({ orientation })
    .withExifMerge({
      IFD0: { Artist: 'PRIVATE_ARTIST', Copyright: 'PRIVATE_COPYRIGHT' },
      IFD2: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '38/1 43/1 0/1',
        GPSLongitudeRef: 'W',
        GPSLongitude: '9/1 8/1 0/1',
      },
    })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">PRIVATE_XMP</x:xmpmeta>')
    .toBuffer();
}
describe('lossless photo metadata filtering', () => {
  it.each(['jpeg', 'png', 'webp'] as const)(
    'removes private %s metadata but preserves decoded pixels and ICC',
    async (format) => {
      const input = await fixture(format),
        output = await sanitizePhotoMetadata(input);
      const before = await sharp(input).metadata(),
        after = await sharp(output).metadata();
      expect(before.exif).toBeDefined();
      expect(before.icc).toBeDefined();
      expect(input.includes(Buffer.from('PRIVATE_ARTIST'))).toBe(true);
      expect(after.icc).toEqual(before.icc);
      expect(after.exif).toBeUndefined();
      expect(after.xmp).toBeUndefined();
      expect(after.iptc).toBeUndefined();
      expect(output.includes(Buffer.from('PRIVATE_'))).toBe(false);
      expect(await sharp(output).raw().toBuffer()).toEqual(await sharp(input).raw().toBuffer());
      expect(await sanitizePhotoMetadata(output)).toEqual(output);
      expect(output.length).toBeLessThan(input.length);
    },
  );
  it.each(['jpeg', 'png', 'webp'] as const)(
    'preserves only the orientation of a legacy %s without re-encoding',
    async (format) => {
      const input = await fixture(format, 6),
        output = await sanitizePhotoMetadata(input);
      const meta = await sharp(output).metadata();
      expect(meta.orientation).toBe(6);
      expect(meta.exif!.length).toBeLessThanOrEqual(32); // One TIFF orientation tag, no GPS/artist/thumbnail IFD.
      expect(output.includes(Buffer.from('PRIVATE_'))).toBe(false);
      expect(await sharp(output).rotate().raw().toBuffer()).toEqual(
        await sharp(input).rotate().raw().toBuffer(),
      );
      expect(await sanitizePhotoMetadata(output)).toEqual(output);
    },
  );
  it('cleans a small new upload without changing its pixels or format', async () => {
    const input = await fixture('jpeg'),
      result = await optimizePhoto(input);
    expect(result.optimized).toBe(false);
    expect(result.contentType).toBe('image/jpeg');
    expect((await sharp(result.buffer).metadata()).exif).toBeUndefined();
    expect(await sharp(result.buffer).raw().toBuffer()).toEqual(
      await sharp(input).raw().toBuffer(),
    );
  });
  it('does not return invalid or truncated containers as an unsafe fallback', async () => {
    await expect(sanitizePhotoMetadata(Buffer.from('invalid'))).rejects.toThrow();
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const input = await fixture(format);
      await expect(sanitizePhotoMetadata(input.subarray(0, input.length - 12))).rejects.toThrow();
    }
  });
  it.each(['jpeg', 'png', 'webp'] as const)(
    'drops trailing private bytes after a complete %s image',
    async (format) => {
      const input = await fixture(format),
        clean = await sanitizePhotoMetadata(input);
      expect(
        await sanitizePhotoMetadata(Buffer.concat([input, Buffer.from('PRIVATE_TRAILER')])),
      ).toEqual(clean);
    },
  );
});

describe('WebP byte compatibility with the pre-optimization sanitizer', () => {
  it.each(webpFixtures.cases)(
    'reuses the already-clean $name without concatenating a new image',
    async (item) => {
      const input = Buffer.from(item.expectedBase64, 'base64'),
        original = Buffer.from(input);
      const concat = vi.spyOn(Buffer, 'concat');
      let output: Buffer;
      try {
        output = await sanitizePhotoMetadata(input);
        expect(concat).not.toHaveBeenCalled();
      } finally {
        concat.mockRestore();
      }
      expect(output!).toBe(input);
      expect(input).toEqual(original);
      expect(await sharp(output!).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer());
    },
  );

  it.each(webpFixtures.cases)('fully validates already-clean $name before reuse', async (item) => {
    const input = Buffer.from(item.expectedBase64, 'base64');
    const cuts = new Set([0, 1, 7, 8, 11, 12, input.length - 1]);
    for (let pos = 12; pos + 8 <= input.length; ) {
      const next = pos + 8 + input.readUInt32LE(pos + 4) + (input.readUInt32LE(pos + 4) % 2);
      cuts.add(pos + 7);
      cuts.add(next - 1);
      pos = next;
    }
    for (const cut of cuts)
      await expect(sanitizePhotoMetadata(input.subarray(0, cut))).rejects.toThrow();
    const oversized = Buffer.from(input);
    oversized.writeUInt32LE(0xffffffff, 4);
    await expect(sanitizePhotoMetadata(oversized)).rejects.toThrow();
  });

  it('still copies when trailing or unknown private bytes must be removed', async () => {
    const clean = Buffer.from(webpFixtures.cases[0]!.expectedBase64, 'base64');
    const trailer = Buffer.concat([clean, Buffer.from('PRIVATE_TRAILER')]);
    const chunk = Buffer.from([0x4a, 0x55, 0x4e, 0x4b, 1, 0, 0, 0, 0x7f, 0xa5]);
    const unknown = Buffer.concat([clean, chunk]);
    unknown.writeUInt32LE(unknown.length - 8, 4);
    for (const input of [trailer, unknown]) {
      const original = Buffer.from(input),
        output = await sanitizePhotoMetadata(input);
      expect(output).not.toBe(input);
      expect(output).toEqual(clean);
      expect(input).toEqual(original);
    }
  });

  it('does not mistake matching lengths for byte-identical orientation metadata', async () => {
    const clean = Buffer.from(webpFixtures.cases[0]!.expectedBase64, 'base64');
    const input = Buffer.from(clean);
    let changed = false;
    for (let pos = 12; pos + 8 <= input.length; ) {
      const size = input.readUInt32LE(pos + 4);
      if (input.toString('ascii', pos, pos + 4) === 'EXIF') {
        // Unused bytes beside the inline SHORT orientation must still be cleared.
        input[pos + 8 + 20] = 0x7f;
        changed = true;
      }
      pos += 8 + size + (size % 2);
    }
    expect(changed).toBe(true);
    expect((await sharp(input).metadata()).orientation).toBe(6);
    const original = Buffer.from(input),
      output = await sanitizePhotoMetadata(input);
    expect(output.length).toBe(input.length);
    expect(output).not.toBe(input);
    expect(output).toEqual(clean);
    expect(input).toEqual(original);
  });

  it.each(webpFixtures.cases)('preserves the exact output of $name', async (item) => {
    const input = Buffer.from(item.inputBase64, 'base64'),
      original = Buffer.from(input);
    const output = await sanitizePhotoMetadata(input);
    expect(output).toEqual(Buffer.from(item.expectedBase64, 'base64'));
    expect(input).toEqual(original);
    expect(output.readUInt32LE(4)).toBe(output.length - 8);
    expect(await sharp(output).raw().toBuffer()).toEqual(await sharp(input).raw().toBuffer());
  });

  it.each(webpFixtures.cases)(
    'still rejects the recorded truncated boundaries of $name',
    async (item) => {
      const input = Buffer.from(item.inputBase64, 'base64');
      for (const cut of item.rejectedCuts) {
        await expect(sanitizePhotoMetadata(input.subarray(0, cut))).rejects.toThrow();
      }
    },
  );

  it('rejects malformed RIFF sizes, chunk sizes and animation chunks', async () => {
    const input = Buffer.from(webpFixtures.cases[0]!.inputBase64, 'base64');
    for (const size of [0, 1, 3, 4, 5, 7, input.length - 9, input.length - 7, 0xffffffff]) {
      const invalid = Buffer.from(input);
      invalid.writeUInt32LE(size, 4);
      await expect(sanitizePhotoMetadata(invalid)).rejects.toThrow();
    }
    // The first chunk is VP8X, whose payload must remain exactly ten bytes.
    expect(input.toString('ascii', 12, 16)).toBe('VP8X');
    for (const size of [0, 9, 11, 0xffffffff]) {
      const invalid = Buffer.from(input);
      invalid.writeUInt32LE(size, 16);
      await expect(sanitizePhotoMetadata(invalid)).rejects.toThrow();
    }
    for (const type of ['ANIM', 'ANMF']) {
      const chunk = Buffer.alloc(8);
      chunk.write(type);
      const invalid = Buffer.concat([input, chunk]);
      invalid.writeUInt32LE(invalid.length - 8, 4);
      await expect(sanitizePhotoMetadata(invalid)).rejects.toThrow();
    }
  });

  it('preserves nonzero padding bytes of retained odd-sized chunks', async () => {
    const input = Buffer.from(webpFixtures.cases[0]!.inputBase64, 'base64');
    let changed = false;
    for (let pos = 12; pos + 8 <= input.length; ) {
      const size = input.readUInt32LE(pos + 4),
        next = pos + 8 + size + (size % 2);
      if (
        size % 2 &&
        ['ALPH', 'VP8 ', 'VP8L', 'ICCP'].includes(input.toString('ascii', pos, pos + 4))
      ) {
        input[next - 1] = 0xa5;
        changed = true;
      }
      pos = next;
    }
    expect(changed).toBe(true);
    const output = await sanitizePhotoMetadata(input);
    expect(output.includes(Buffer.from([0xa5]))).toBe(true);
    expect(await sanitizePhotoMetadata(output)).toEqual(output);
    expect(await sharp(output).raw().toBuffer()).toEqual(await sharp(input).raw().toBuffer());
  });
});
