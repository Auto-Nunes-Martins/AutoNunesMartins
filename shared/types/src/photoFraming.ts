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
export const galleryFramingSchema = z
  .record(z.string().min(1).max(160), photoFramingSchema)
  .refine((value) => Object.keys(value).length <= 20, 'Máximo de 20 enquadramentos.');
export function framingStyle(value?: PhotoFraming) {
  return value
    ? `--photo-desktop:${value.desktop.x}% ${value.desktop.y}%;--photo-mobile:${value.mobile.x}% ${value.mobile.y}%`
    : undefined;
}
