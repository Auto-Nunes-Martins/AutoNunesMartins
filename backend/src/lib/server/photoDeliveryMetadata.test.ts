import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
const mock = vi.hoisted(() => ({ data: Buffer.alloc(0), download: vi.fn() }));
vi.mock('../data/storage.js', () => ({ getBucketName: () => 'private', getSupabase: () => ({ storage: { from: () => ({ download: mock.download }) } }) }));
import { readPhotoBytes, forgetPhotoVariants } from './photoVariants.js';
const path = 'clabcdefghijklmnopqrstuvw/12345678-1234-1234-1234-123456789abc.jpg';
beforeEach(async () => {
  forgetPhotoVariants(path);
  mock.data = await sharp({ create: { width: 48, height: 32, channels: 3, background: '#387b94' } }).jpeg().withMetadata({ orientation: 6 }).withExifMerge({ IFD0: { Artist: 'PRIVATE_ARTIST' } }).toBuffer();
  mock.download.mockImplementation(async p => p === path ? { data: new Blob([new Uint8Array(mock.data)], { type: 'image/jpeg' }), error: null } : { data: null, error: { statusCode: 404 } });
});
it.each([undefined, 320, 2560] as const)('sanitizes existing originals and fallback at width %s with a new content ETag', async width => {
  const stored = Buffer.from(mock.data), photo = await readPhotoBytes(path, width);
  expect(photo).not.toBeNull(); expect(photo!.buffer.includes(Buffer.from('PRIVATE_ARTIST'))).toBe(false);
  expect(await sharp(photo!.buffer).rotate().raw().toBuffer()).toEqual(await sharp(stored).rotate().raw().toBuffer());
  const oldEtag = '"' + createHash('sha256').update(path).update(stored).digest('hex') + '"';
  expect(photo!.etag).not.toBe(oldEtag);
  expect(mock.data).toEqual(stored);
});
it('fails closed for an unreadable original rather than returning unfiltered bytes', async () => {
  mock.data = Buffer.from('corrupt original PRIVATE_ARTIST');
  expect(await readPhotoBytes(path)).toBeNull();
});
