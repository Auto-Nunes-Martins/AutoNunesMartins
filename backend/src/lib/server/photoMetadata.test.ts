import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sanitizePhotoMetadata } from './photoMetadata.js';
import { optimizePhoto } from './photoOptimization.js';

async function fixture(format: 'jpeg' | 'png' | 'webp', orientation = 1) {
  const raw = Buffer.from(Array.from({ length: 48 * 32 * 3 }, (_, i) => i * 37 % 256));
  return sharp(raw, { raw: { width: 48, height: 32, channels: 3 } })
    .toFormat(format, { quality: 90, progressive: true })
    .withMetadata({ orientation })
    .withExifMerge({ IFD0: { Artist: 'PRIVATE_ARTIST', Copyright: 'PRIVATE_COPYRIGHT' }, IFD2: { GPSLatitudeRef: 'N', GPSLatitude: '38/1 43/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '9/1 8/1 0/1' } })
    .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/">PRIVATE_XMP</x:xmpmeta>')
    .toBuffer();
}
describe('lossless photo metadata filtering', () => {
  it.each(['jpeg', 'png', 'webp'] as const)('removes private %s metadata but preserves decoded pixels and ICC', async format => {
    const input = await fixture(format), output = await sanitizePhotoMetadata(input);
    const before = await sharp(input).metadata(), after = await sharp(output).metadata();
    expect(before.exif).toBeDefined(); expect(before.icc).toBeDefined();
    expect(input.includes(Buffer.from('PRIVATE_ARTIST'))).toBe(true);
    expect(after.icc).toEqual(before.icc);
    expect(after.exif).toBeUndefined(); expect(after.xmp).toBeUndefined(); expect(after.iptc).toBeUndefined();
    expect(output.includes(Buffer.from('PRIVATE_'))).toBe(false);
    expect(await sharp(output).raw().toBuffer()).toEqual(await sharp(input).raw().toBuffer());
    expect(await sanitizePhotoMetadata(output)).toEqual(output);
    expect(output.length).toBeLessThan(input.length);
  });
  it.each(['jpeg', 'png', 'webp'] as const)('preserves only the orientation of a legacy %s without re-encoding', async format => {
    const input = await fixture(format, 6), output = await sanitizePhotoMetadata(input);
    const meta = await sharp(output).metadata();
    expect(meta.orientation).toBe(6);
    expect(meta.exif!.length).toBeLessThanOrEqual(32); // One TIFF orientation tag, no GPS/artist/thumbnail IFD.
    expect(output.includes(Buffer.from('PRIVATE_'))).toBe(false);
    expect(await sharp(output).rotate().raw().toBuffer()).toEqual(await sharp(input).rotate().raw().toBuffer());
    expect(await sanitizePhotoMetadata(output)).toEqual(output);
  });
  it('cleans a small new upload without changing its pixels or format', async () => {
    const input = await fixture('jpeg'), result = await optimizePhoto(input);
    expect(result.optimized).toBe(false); expect(result.contentType).toBe('image/jpeg');
    expect((await sharp(result.buffer).metadata()).exif).toBeUndefined();
    expect(await sharp(result.buffer).raw().toBuffer()).toEqual(await sharp(input).raw().toBuffer());
  });
  it('does not return invalid or truncated containers as an unsafe fallback', async () => {
    await expect(sanitizePhotoMetadata(Buffer.from('invalid'))).rejects.toThrow();
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const input = await fixture(format);
      await expect(sanitizePhotoMetadata(input.subarray(0, input.length - 12))).rejects.toThrow();
    }
  });
  it.each(['jpeg', 'png', 'webp'] as const)('drops trailing private bytes after a complete %s image', async format => {
    const input = await fixture(format), clean = await sanitizePhotoMetadata(input);
    expect(await sanitizePhotoMetadata(Buffer.concat([input, Buffer.from('PRIVATE_TRAILER')]))).toEqual(clean);
  });
});
