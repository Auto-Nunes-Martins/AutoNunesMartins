import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import {
  optimizePhoto,
  PhotoAdmission,
  PHOTO_TARGET_BYTES,
  MAX_OUTPUT_BYTES,
} from './photoOptimization';

describe('new photo pipeline', () => {
  it('preserves a small valid file without inflation or recompression', async () => {
    const input = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#a12f38' },
    })
      .jpeg({ quality: 94 })
      .toBuffer();
    const result = await optimizePhoto(input);
    expect(result.optimized).toBe(false);
    expect(result.buffer.equals(input)).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
    expect(result.extension).toBe('jpg');
  });
  it('preserves the repository photographic JPEG fixture when already suitable', async () => {
    const input = await readFile(
      new URL(
        '../../../../apps/website/static/images/about/auto-nunes-martins-fachada-v2-1024.jpg',
        import.meta.url,
      ),
    );
    const result = await optimizePhoto(input);
    const meta = await sharp(result.buffer).metadata();
    expect(result.optimized).toBe(false);
    expect(result.buffer.equals(input)).toBe(true);
    expect(meta.width).toBe(1024);
    console.info(
      JSON.stringify({
        fixture: 'repository photographic JPEG',
        inputBytes: input.length,
        outputBytes: result.buffer.length,
      }),
    );
  });
  it('normalizes EXIF rotation and coherent WebP dimensions and MIME', async () => {
    const input = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#287f91' },
    })
      .jpeg({ quality: 95 })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await optimizePhoto(input);
    const meta = await sharp(result.buffer).metadata();
    expect(result.extension).toBe('webp');
    expect(result.contentType).toBe('image/webp');
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThan(meta.height!);
    expect(meta.height).toBe(2560);
    expect(meta.orientation).toBeUndefined();
    expect(result.buffer.length).toBeLessThan(PHOTO_TARGET_BYTES);
  });
  it('handles a detailed phone-sized image with bounded output and small pixel error', async () => {
    const width = 4032,
      height = 3024;
    const pixels = Buffer.alloc(width * height * 3);
    let state = 123456;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        state = (state * 1664525 + 1013904223) >>> 0;
        const i = (y * width + x) * 3;
        const noise = (state >>> 24) / 5;
        pixels[i] = (x / width) * 150 + noise;
        pixels[i + 1] = (y / height) * 170 + noise;
        pixels[i + 2] = 80 + Math.sin(x / 40) * 40 + noise;
      }
    const input = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toBuffer();
    expect(input.length).toBeGreaterThan(5_000_000);
    const result = await optimizePhoto(input);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(2560);
    expect(meta.height! / meta.width!).toBeCloseTo(height / width, 2);
    expect(result.buffer.length).toBeLessThan(MAX_OUTPUT_BYTES);
    const reference = await sharp(input).resize(meta.width, meta.height).raw().toBuffer();
    const decoded = await sharp(result.buffer).raw().toBuffer();
    let error = 0;
    for (let i = 0; i < reference.length; i++) error += Math.abs(reference[i]! - decoded[i]!);
    expect(error / reference.length).toBeLessThan(8);
    console.info(
      JSON.stringify({
        fixture: 'synthetic phone texture',
        inputBytes: input.length,
        outputBytes: result.buffer.length,
        width: meta.width,
        height: meta.height,
        meanAbsoluteError: error / reference.length,
      }),
    );
  }, 30000);
  it('preserves detail above the approximate target while respecting the defensive output limit', async () => {
    const width = 1800,
      height = 1600;
    const noise = Buffer.alloc(width * height * 3);
    let seed = 91234;
    for (let i = 0; i < noise.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      noise[i] = seed >>> 24;
    }
    const input = await sharp(noise, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const result = await optimizePhoto(input);
    const meta = await sharp(result.buffer).metadata();
    expect(result.buffer.length).toBeGreaterThan(PHOTO_TARGET_BYTES);
    expect(result.buffer.length).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
    expect(meta.width).toBeLessThan(width);
    console.info(
      JSON.stringify({
        fixture: 'high-detail noise',
        inputBytes: input.length,
        outputBytes: result.buffer.length,
        width: meta.width,
        height: meta.height,
      }),
    );
  }, 30000);
  it('rejects invalid, byte-oversized and pixel-oversized inputs', async () => {
    await expect(optimizePhoto(Buffer.from('not an image'))).rejects.toMatchObject({ status: 422 });
    await expect(optimizePhoto(Buffer.alloc(21 * 1024 * 1024))).rejects.toMatchObject({
      status: 413,
    });
    const input = await sharp({
      create: { width: 6000, height: 5000, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    await expect(optimizePhoto(input)).rejects.toMatchObject({ status: 422 });
  });
  it('rejects concurrent admission and releases once after failure', () => {
    const gate = new PhotoAdmission();
    const release = gate.acquire()!;
    expect(gate.acquire()).toBeNull();
    release();
    const next = gate.acquire()!;
    release();
    expect(gate.acquire()).toBeNull();
    next();
    expect(gate.acquire()).toBeTypeOf('function');
  });
});
