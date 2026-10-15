import { z } from 'zod';
import { publicVehicleSchema, publicPhoto, publicHref } from './publicVehicles';

export const publicHighlightsSchema = z.object({
  configured: z.boolean(),
  items: z
    .array(
      z
        .object({ vehicle: publicVehicleSchema, photoIndex: z.number().int().min(0).max(19) })
        .refine((item) => item.photoIndex < item.vehicle.photos.length),
    )
    .max(5),
});
export type PublicHighlights = z.infer<typeof publicHighlightsSchema>;
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
    image: publicPhoto(vehicle.slug, photoIndex),
    href: publicHref(vehicle.slug),
    illustrative: false,
  }));
}
