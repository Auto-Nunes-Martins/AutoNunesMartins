import { z } from 'zod';
import { photoFramingSchema } from '@anm/types';
import { publicVehicleSchema, publicPhoto, publicHref, type PublicVehicle } from './publicVehicles';
import { detailPhotoDimensions } from './vehiclePhotoSources';

export const publicHighlightsSchema = z.object({
  configured: z.boolean(),
  items: z
    .array(
      z
        .object({
          vehicle: publicVehicleSchema,
          photoIndex: z.number().int().min(0).max(19),
          framing: photoFramingSchema.optional(),
        })
        .refine((item) => item.photoIndex < item.vehicle.photos.length),
    )
    .max(5),
});
export type PublicHighlights = z.infer<typeof publicHighlightsSchema>;

/** Reuse the stock response already on this page; never fetch metadata for the hero. */
export function highlightPhotoDimensions(
  item: PublicHighlights['items'][number] | undefined,
  stock: readonly PublicVehicle[] = [],
) {
  if (!item || !Number.isInteger(item.photoIndex) || item.photoIndex < 0) return undefined;
  const source = item.vehicle.photos[item.photoIndex];
  if (!source) return undefined;
  const own = detailPhotoDimensions(item.vehicle, item.photoIndex);
  if (own) return own;
  const matching = stock.find(
    (vehicle) => vehicle.slug === item.vehicle.slug && vehicle.photos[item.photoIndex] === source,
  );
  return matching ? detailPhotoDimensions(matching, item.photoIndex) : undefined;
}
export type HeroSlide = {
  id: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  image: string;
  href: string;
  illustrative: boolean;
};
export function highlightSlides(highlights: PublicHighlights): HeroSlide[] {
  return highlights.items.map(({ vehicle, photoIndex }) => ({
    id: vehicle.slug,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    km: vehicle.mileage,
    image: publicPhoto(vehicle, photoIndex),
    href: publicHref(vehicle.slug),
    illustrative: false,
  }));
}
