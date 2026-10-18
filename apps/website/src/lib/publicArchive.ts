import { z } from 'zod';
import { slugPattern } from './publicVehicles';
export const publicArchiveSchema = z
  .object({
    slug: z.string().max(180).regex(slugPattern),
    brand: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    year: z.number().int(),
    photo: z.string().max(240).nullable(),
  })
  .refine(
    (value) => value.photo === null || value.photo === `/viaturas/${value.slug}/arquivo/foto`,
  );
export type PublicArchive = z.infer<typeof publicArchiveSchema>;
