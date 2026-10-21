import { z } from 'zod';
import { slugPattern } from './publicVehicles';
export const unavailableVehicleSchema = z
  .object({
    slug: z.string().max(180).regex(slugPattern),
    brand: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    year: z.number().int(),
    summary: z.string().max(400).optional(),
    photo: z.string().max(240).nullable(),
  })
  .refine(
    (value) => value.photo === null || value.photo === `/viaturas/${value.slug}/indisponivel/foto`,
  );
export type UnavailableVehicle = z.infer<typeof unavailableVehicleSchema>;
