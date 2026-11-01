import { z } from 'zod';

/** CSS object-position percentages, independent of the immutable image bytes. */
export const photoPositionSchema = z
  .object({
    x: z.number().finite().min(0).max(100),
    y: z.number().finite().min(0).max(100),
  })
  .strict();
export const photoFramingSchema = z
  .object({
    desktop: photoPositionSchema,
    mobile: photoPositionSchema,
  })
  .strict();
export type PhotoFraming = z.infer<typeof photoFramingSchema>;
// Legacy desktop/mobile coordinates continue to mean the public detail photograph.
// Card coordinates belong to this photo, even while another photo is the cover.
export const galleryPhotoFramingSchema = photoFramingSchema.extend({
  card: photoFramingSchema.nullable().optional(),
});
export type GalleryPhotoFraming = z.infer<typeof galleryPhotoFramingSchema>;
export const galleryFramingSchema = z
  .record(z.string().min(1).max(160), galleryPhotoFramingSchema)
  .refine((value) => Object.keys(value).length <= 20, 'Máximo de 20 enquadramentos.');

export function withGalleryDestination(
  current: GalleryPhotoFraming | undefined,
  destination: 'card' | 'detail',
  value?: PhotoFraming,
): GalleryPhotoFraming | undefined {
  const centre = { desktop: { x: 50, y: 50 }, mobile: { x: 50, y: 50 } };
  if (destination === 'card')
    return value
      ? { ...(current ?? centre), card: value }
      : current?.card
        ? { ...current, card: null }
        : current;
  if (value) return { ...value, ...(current?.card !== undefined ? { card: current.card } : {}) };
  return current?.card ? { ...centre, card: current.card } : undefined;
}

/** Older callers only know detail coordinates; do not erase a saved card crop. */
export function mergeGalleryPhotoFraming(
  current: GalleryPhotoFraming | undefined,
  incoming: GalleryPhotoFraming | null | undefined,
) {
  if (!incoming) return withGalleryDestination(current, 'detail');
  return {
    ...incoming,
    ...(incoming.card === undefined && current?.card !== undefined ? { card: current.card } : {}),
  };
}
export function framingStyle(value?: PhotoFraming) {
  return value
    ? `--photo-desktop:${value.desktop.x}% ${value.desktop.y}%;--photo-mobile:${value.mobile.x}% ${value.mobile.y}%`
    : undefined;
}
