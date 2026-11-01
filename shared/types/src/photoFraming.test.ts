import { expect, it } from 'vitest';
import {
  galleryFramingSchema,
  photoFramingSchema,
  framingStyle,
  withGalleryDestination,
  mergeGalleryPhotoFraming,
} from './photoFraming';

const framing = { desktop: { x: 0, y: 100 }, mobile: { x: 12.5, y: 72 } };
it('keeps card and detail independent, including resets and legacy detail writes', () => {
  const card = { desktop: { x: 50, y: 20 }, mobile: { x: 50, y: 30 } };
  const both = withGalleryDestination(framing, 'card', card)!;
  expect(galleryFramingSchema.parse({ photo: both }).photo).toEqual({ ...framing, card });
  expect(
    withGalleryDestination(both, 'detail', { desktop: { x: 50, y: 90 }, mobile: { x: 50, y: 95 } })
      ?.card,
  ).toEqual(card);
  expect(withGalleryDestination(both, 'card')).toEqual({ ...framing, card: null });
  expect(withGalleryDestination(both, 'detail')).toEqual({
    desktop: { x: 50, y: 50 },
    mobile: { x: 50, y: 50 },
    card,
  });
  expect(mergeGalleryPhotoFraming(both, framing)?.card).toEqual(card);
  expect(mergeGalleryPhotoFraming(both, { ...framing, card: null })?.card).toBeNull();
  expect(
    galleryFramingSchema.safeParse({
      photo: { ...framing, card: { ...card, desktop: { x: 101, y: 0 } } },
    }).success,
  ).toBe(false);
});
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
