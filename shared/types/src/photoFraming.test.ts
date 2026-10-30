import { expect, it } from 'vitest';
import { galleryFramingSchema, photoFramingSchema, framingStyle } from './photoFraming';

const framing = { desktop: { x: 0, y: 100 }, mobile: { x: 12.5, y: 72 } };
it('keeps independent device positions and exact edges', () => {
  expect(photoFramingSchema.parse(framing)).toEqual(framing);
  expect(framingStyle(framing)).toBe('--photo-desktop:0% 100%;--photo-mobile:12.5% 72%');
  expect(framingStyle()).toBeUndefined();
});
it.each([-1, 101, NaN, Infinity, '50', null])('rejects invalid coordinate %s', (value) => {
  expect(photoFramingSchema.safeParse({ ...framing, desktop: { x: value, y: 50 } }).success).toBe(
    false,
  );
});
it('bounds maps and rejects incomplete or unexpected fields', () => {
  expect(
    galleryFramingSchema.safeParse(
      Object.fromEntries(Array.from({ length: 21 }, (_, i) => [String(i), framing])),
    ).success,
  ).toBe(false);
  expect(photoFramingSchema.safeParse({ desktop: framing.desktop }).success).toBe(false);
  expect(photoFramingSchema.safeParse({ ...framing, url: 'private' }).success).toBe(false);
});
