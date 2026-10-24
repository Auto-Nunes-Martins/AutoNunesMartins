import { afterEach, expect, it, vi } from 'vitest';
import { PhotoByteCache } from './photoByteCache.js';

afterEach(() => vi.restoreAllMocks());
const photo = (bytes: number) => ({
  buffer: Buffer.alloc(bytes),
  contentType: 'image/webp',
  etag: 'fixture',
  until: 0,
});

it('keeps thumbnails past a minute, expires them after ten and invalidates every size', () => {
  const cache = new PhotoByteCache();
  const time = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(time);
  cache.set('owner/photo.jpg|320', photo(20_000), 320, true);
  cache.set('owner/photo.jpg|800', photo(80_000), 800, true);
  cache.set('owner/large.jpg|1600', photo(300_000), 1600, true);
  clock.mockReturnValue(time + 61_000);
  expect(cache.get('owner/photo.jpg|320')).toBeDefined();
  expect(cache.get('owner/large.jpg|1600')).toBeUndefined();
  cache.forget('owner/photo.jpg');
  expect(cache.get('owner/photo.jpg|320')).toBeUndefined();
  expect(cache.get('owner/photo.jpg|800')).toBeUndefined();
  cache.set('other|320', photo(20_000), 320, true);
  clock.mockReturnValue(time + 661_000);
  expect(cache.get('other|320')).toBeUndefined();
});

it('protects thumbnails from gallery eviction and bounds the combined pixel storage at 12 MiB', () => {
  const cache = new PhotoByteCache();
  const mib = 1024 * 1024;
  for (let i = 0; i < 8; i++) cache.set(`thumb${i}|800`, photo(mib / 2), 800, true);
  cache.get('thumb0|800'); // Recently used survives the next thumbnail eviction.
  cache.set('thumb8|800', photo(mib / 2), 800, true);
  expect(cache.get('thumb1|800')).toBeDefined(); // Borrows unused gallery capacity.
  expect(cache.get('thumb0|800')).toBeDefined();
  for (let i = 0; i < 20; i++) cache.set(`large${i}|1600`, photo(mib), 1600, true);
  const thumbnails = Array.from({ length: 9 }, (_, i) => cache.get(`thumb${i}|800`));
  const large = Array.from({ length: 20 }, (_, i) => cache.get(`large${i}|1600`));
  expect(thumbnails.filter(Boolean)).toHaveLength(8);
  expect(large.filter(Boolean)).toHaveLength(8);
  expect([...thumbnails, ...large].reduce((n, p) => n + (p?.buffer.length ?? 0), 0)).toBe(12 * mib);
});

it('lets gallery responses borrow unused thumbnail capacity without exceeding the total', () => {
  const cache = new PhotoByteCache();
  const mib = 1024 * 1024;
  for (let i = 0; i < 12; i++) cache.set(`gallery${i}|1600`, photo(mib), 1600, true);
  expect(
    Array.from({ length: 12 }, (_, i) => cache.get(`gallery${i}|1600`)).filter(Boolean),
  ).toHaveLength(12);
  cache.set('thumb|320', photo(mib / 2), 320, true);
  expect(cache.get('gallery0|1600')).toBeUndefined();
  expect(cache.get('thumb|320')).toBeDefined();
});

it('keeps original fallbacks out of the thumbnail reservation', () => {
  const cache = new PhotoByteCache();
  const time = Date.now();
  const clock = vi.spyOn(Date, 'now').mockReturnValue(time);
  cache.set('legacy|320', photo(20_000), 320, false);
  clock.mockReturnValue(time + 60_001);
  expect(cache.get('legacy|320')).toBeUndefined();
});
