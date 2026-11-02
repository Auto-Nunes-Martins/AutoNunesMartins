import { expect, it, vi } from 'vitest';
import sharp from 'sharp';
const workers = vi.hoisted(() => ({
  children: [] as import('node:child_process').ChildProcess[],
  environments: [] as NodeJS.ProcessEnv[],
}));
vi.mock('node:child_process', async (original) => {
  const actual = await original<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: (file: string, args: string[], options: import('node:child_process').SpawnOptions) => {
      const child = actual.spawn(file, args, options);
      workers.children.push(child);
      workers.environments.push(options.env ?? {});
      return child;
    },
  };
});
import { PhotoEncodingSession } from './photoEncodingSession';
import { MAX_REVIEW_AVATAR_BYTES, normalizeReviewAvatar } from './reviewAvatar';

it.each(['orientation', 'alpha', '16-megapixel-boundary'] as const)(
  'preserves avatar bytes, hash and stripped metadata for %s, then closes the real child',
  async (fixture) => {
    const pixels = Buffer.alloc(192 * 128 * 4);
    for (let y = 0; y < 128; y++)
      for (let x = 0; x < 192; x++) {
        const offset = (y * 192 + x) * 4;
        pixels[offset] = x;
        pixels[offset + 1] = y * 2;
        pixels[offset + 2] = ((x >> 4) ^ (y >> 4)) & 1 ? 200 : 40;
        pixels[offset + 3] = fixture === 'alpha' ? x : 255;
      }
    const image =
      fixture === '16-megapixel-boundary'
        ? sharp({ create: { width: 4000, height: 4000, channels: 3, background: '#42759d' } })
        : sharp(pixels, { raw: { width: 192, height: 128, channels: 4 } });
    const input =
      fixture === 'orientation'
        ? await image.jpeg().withMetadata({ orientation: 6 }).toBuffer()
        : await image.png().toBuffer();
    const expected = await normalizeReviewAvatar(input);

    const session = new PhotoEncodingSession();
    const child = workers.children.at(-1)!;
    expect(
      Object.keys(workers.environments.at(-1)!).some((key) =>
        /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
      ),
    ).toBe(false);
    try {
      const actual = await session.avatar(input);
      expect(actual).toEqual(expected);
      // Baseline WebP84 outputs, generated with the repository's pinned Sharp version.
      if (fixture === 'orientation')
        expect(actual.avatarVersion).toBe(
          '2519cebb8b5aea8413288809c5455ed54bd3fd7371d42fb99f8f14d7714dd842',
        );
      if (fixture === 'alpha')
        expect(actual.avatarVersion).toBe(
          'f67a009713277335cc31c20d54afeb923171c2f585352f41fb33ae7828c2d369',
        );
      const metadata = await sharp(actual.avatarData).metadata();
      expect(metadata).toMatchObject({ format: 'webp', width: 128, height: 128 });
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      if (fixture === 'alpha') expect(metadata.hasAlpha).toBe(true);
    } finally {
      await session.close();
      expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
    }
  },
  30000,
);

it('keeps the input byte limit, raster validation and pixel limit in the isolated codec', async () => {
  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
  try {
    await expect(session.avatar(Buffer.alloc(MAX_REVIEW_AVATAR_BYTES + 1))).rejects.toMatchObject({
      status: 422,
    });
    await expect(session.avatar(Buffer.from('<svg width="1" height="1"/>'))).rejects.toMatchObject({
      status: 422,
    });
    const oversizedPixels = await sharp({
      create: { width: 4001, height: 4000, channels: 3, background: '#42759d' },
    })
      .png()
      .toBuffer();
    await expect(session.avatar(oversizedPixels)).rejects.toMatchObject({ status: 422 });
  } finally {
    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }
});

it('rejects corrupt data and animation in the real avatar worker', async () => {
  const animation = await sharp(Buffer.from([255, 0, 0, 0, 0, 255]), {
    raw: { width: 1, height: 2, channels: 3, pageHeight: 1 },
  })
    .gif({ loop: 0, delay: [10, 10] })
    .toBuffer();
  expect((await sharp(animation).metadata()).pages).toBe(2);

  const session = new PhotoEncodingSession();
  const child = workers.children.at(-1)!;
  expect(
    Object.keys(workers.environments.at(-1)!).some((key) =>
      /DATABASE|DIRECT_URL|SUPABASE|CLERK|SECRET|TOKEN|PASSWORD/.test(key),
    ),
  ).toBe(false);
  try {
    await expect(session.avatar(Buffer.alloc(0))).rejects.toMatchObject({ status: 422 });
    await expect(session.avatar(Buffer.from('not an image'))).rejects.toMatchObject({
      status: 422,
    });
    await expect(session.avatar(animation)).rejects.toMatchObject({ status: 422 });
  } finally {
    await session.close();
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  }
});
