import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { renderBrandSocialImage, renderSocialPhoto, cachedSocialImage } from './socialImages.js';
import {
  socialPhotoPosition,
  socialPhotoVersion,
  savedSocialPhotoPosition,
} from './socialPhotoIdentity.js';

const bands = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="420"><path fill="red" d="M0 0h140v140H0z"/><path fill="#00ff00" d="M0 140h140v140H0z"/><path fill="blue" d="M0 280h140v140H0z"/></svg>',
);
const centre = { x: 50, y: 50 };
const framing = {
  desktop: { x: 50, y: 100, zoom: 1.2 },
  mobile: { x: 20, y: 0 },
  card: { desktop: centre, mobile: centre },
};
async function pixel(buffer: Buffer, x: number, y: number) {
  return [
    ...(await sharp(buffer)
      .extract({ left: x, top: y, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ];
}
describe('social main-photo framing', () => {
  it('matches saved top, middle and bottom object-position instead of centre-cropping every photo', async () => {
    const original = await sharp(bands).png().toBuffer();
    for (const [y, channel] of [
      [0, 0],
      [50, 1],
      [100, 2],
    ]) {
      const image = await renderSocialPhoto(original, { x: 50, y });
      const metadata = await sharp(image).metadata();
      expect(metadata).toMatchObject({ format: 'jpeg', width: 1260, height: 900 });
      expect(metadata.exif).toBeUndefined();
      const rgb = await pixel(image, 630, 450);
      expect(rgb[channel!]!).toBeGreaterThan(245);
      expect(rgb.filter((_, index) => index !== channel).every((value) => value < 10)).toBe(true);
    }
    expect((await sharp(original).metadata()).height).toBe(420);
  });
  it('keeps the entire image for contain, including its blurred backdrop, and respects zoom', async () => {
    const input = await sharp(bands).png().toBuffer();
    const contained = await renderSocialPhoto(input, { ...centre, fit: 'contain' });
    expect((await pixel(contained, 630, 100))[0]).toBeGreaterThan(245);
    expect((await pixel(contained, 630, 800))[2]).toBeGreaterThan(245);
    const background = await pixel(contained, 20, 450);
    expect(background[1]).toBeGreaterThan(30);
    expect(background[1]).toBeLessThan(200);
    const zoomed = await renderSocialPhoto(input, { ...centre, fit: 'contain', zoom: 3 });
    expect((await pixel(zoomed, 630, 100))[1]).toBeGreaterThan(240);
    expect((await pixel(zoomed, 630, 800))[1]).toBeGreaterThan(240);
  });
  it('versions only the approved main photograph and desktop composition, not card/mobile crops', () => {
    const initial = socialPhotoVersion('owner/photo.webp', socialPhotoPosition(framing));
    const previousRecipe = createHash('sha256')
      .update(JSON.stringify(['social-main-v1', 'owner/photo.webp', socialPhotoPosition(framing)]))
      .digest('hex');
    expect(initial).not.toBe(previousRecipe);
    expect(socialPhotoVersion('owner/other.webp', socialPhotoPosition(framing))).not.toBe(initial);
    expect(
      socialPhotoVersion('owner/photo.webp', socialPhotoPosition({ ...framing, desktop: centre })),
    ).not.toBe(initial);
    expect(
      socialPhotoVersion('owner/photo.webp', socialPhotoPosition({ ...framing, mobile: centre })),
    ).toBe(initial);
    expect(savedSocialPhotoPosition({ 'owner/photo.webp': framing }, 'owner/photo.webp')).toEqual({
      ...framing.desktop,
      fit: 'cover',
    });
    expect(savedSocialPhotoPosition({}, 'owner/photo.webp')).toEqual({
      ...centre,
      zoom: 1,
      fit: 'cover',
    });
  });
  it('keeps the same red-and-white brand in the lower-right on light and dark photos', async () => {
    for (const background of ['#ffffff', '#101112']) {
      const original = await sharp({
        create: { width: 1260, height: 900, channels: 3, background },
      })
        .png()
        .toBuffer();
      const result = await renderSocialPhoto(original, { ...centre, zoom: 2 });
      const { data, info } = await sharp(result)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const red = [];
      for (let i = 0; i < data.length; i += 3) {
        if (data[i]! > 150 && data[i + 1]! < 100 && data[i + 2]! < 100) {
          red.push({ x: (i / 3) % info.width, y: Math.floor(i / 3 / info.width) });
        }
      }
      expect(red.length).toBeGreaterThan(2000);
      expect(red.every(({ x, y }) => x >= 920 && x < 1230 && y >= 745 && y < 870)).toBe(true);
      expect(
        Math.max(...red.map(({ x }) => x)) - Math.min(...red.map(({ x }) => x)),
      ).toBeGreaterThan(270);
      // Neither the original nor areas away from the brand acquire a new tint.
      const expected = await pixel(original, 630, 450);
      const actual = await pixel(result, 630, 450);
      expect(actual.every((channel, i) => Math.abs(channel - expected[i]!) <= 2)).toBe(true);
      const corner = await sharp(result)
        .extract({ left: 1020, top: 790, width: 200, height: 75 })
        .removeAlpha()
        .raw()
        .toBuffer();
      let white = 0;
      for (let i = 0; i < corner.length; i += 3) {
        if (corner[i]! > 240 && corner[i + 1]! > 240 && corner[i + 2]! > 240) white++;
      }
      expect(white).toBeGreaterThan(1000);
    }
  });
});
it('shares in-flight rendering, reuses pixels and bounds concurrent unique renders', async () => {
  let release!: (buffer: Buffer) => void;
  const generate = vi.fn(
    () =>
      new Promise<Buffer>((resolve) => {
        release = resolve;
      }),
  );
  const first = cachedSocialImage('cache-fixture-1', generate);
  const duplicate = cachedSocialImage('cache-fixture-1', generate);
  let releaseSecond!: (buffer: Buffer) => void;
  const second = cachedSocialImage(
    'cache-fixture-2',
    () =>
      new Promise<Buffer>((resolve) => {
        releaseSecond = resolve;
      }),
  );
  await expect(
    cachedSocialImage('overload-fixture', async () => Buffer.from('ignored')),
  ).rejects.toThrow('busy');
  release(Buffer.from('first'));
  releaseSecond(Buffer.from('second'));
  const [a, b] = await Promise.all([first, duplicate, second]);
  expect(a).toBe(b);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(await cachedSocialImage('cache-fixture-1', generate)).toBe(a);
});
it('serves the original logo at legacy artwork URLs without rendering any text', async () => {
  const brand = await renderBrandSocialImage();
  const original = await sharp(fileURLToPath(new URL('./social/logo-preview.png', import.meta.url)))
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .toBuffer();
  expect(brand.equals(original)).toBe(true);
  expect(await sharp(brand).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
  expect(brand.length).toBeLessThan(150_000);
});
