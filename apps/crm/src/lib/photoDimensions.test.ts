import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { photoDimensions } from './photoDimensions';

describe('photo dimension preflight', () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    it(`reads ${format} dimensions from a real encoded image`, async () => {
      const bytes = await sharp({
        create: { width: 321, height: 123, channels: 3, background: '#824210' },
      })
        .toFormat(format)
        .toBuffer();
      expect(photoDimensions(Uint8Array.from(bytes).buffer)).toEqual({ width: 321, height: 123 });
    });
  }
  it('reads progressive JPEG with EXIF before pixel decoding', async () => {
    const bytes = await sharp({
      create: { width: 6000, height: 5000, channels: 3, background: '#824210' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg({ progressive: true })
      .toBuffer();
    expect(photoDimensions(Uint8Array.from(bytes).buffer)).toEqual({ width: 6000, height: 5000 });
  });
  it('reads lossless WebP and rejects truncated or unknown input safely', async () => {
    const bytes = await sharp({
      create: { width: 512, height: 432, channels: 3, background: '#824210' },
    })
      .webp({ lossless: true })
      .toBuffer();
    expect(photoDimensions(Uint8Array.from(bytes).buffer)).toEqual({ width: 512, height: 432 });
    for (let length = 0; length < 24; length++)
      expect(photoDimensions(new ArrayBuffer(length))).toBeUndefined();
    expect(photoDimensions(Uint8Array.from([255, 216, 255, 225, 255, 255]).buffer)).toBeUndefined();
    expect(photoDimensions(Uint8Array.from([255, 216, 255, 255, 255, 255]).buffer)).toBeUndefined();
  });
});
