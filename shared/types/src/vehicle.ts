import { registeredBrandSchema } from './brands.js';
import { z } from 'zod';
import { FuelEnum, VehicleStatusEnum } from './enums.js';
import { moneySchema } from './decimal.js';

export const pendingDocFlagsSchema = z.object({
  financing: z.boolean().default(false),
  imt: z.boolean().default(false),
  registration: z.boolean().default(false),
  docs: z.boolean().default(false),
});
export type PendingDocFlags = z.infer<typeof pendingDocFlagsSchema>;

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Portuguese license plate: six alphanumeric characters in one of
 * three historical formats:
 *   • 00-00-AA   (1992 – 2005)
 *   • 00-AA-00   (2005 – 2020)
 *   • AA-00-AA   (2020 +)
 *
 * Accepts input with or without dashes/spaces, any casing, and normalizes
 * to the canonical "XX-XX-XX" form on parse so the database always stores
 * a single representation (good for uniqueness + display consistency).
 */
const PT_PLATE_PATTERNS: RegExp[] = [
  /^\d{2}\d{2}[A-Z]{2}$/, // 00-00-AA
  /^\d{2}[A-Z]{2}\d{2}$/, // 00-AA-00
  /^[A-Z]{2}\d{2}[A-Z]{2}$/, // AA-00-AA
];
export const licensePlatePtSchema = z
  .string()
  .trim()
  .min(1)
  .max(10)
  .transform((raw, ctx) => {
    const compact = raw.replace(/[\s-]/g, '').toUpperCase();
    if (compact.length !== 6 || !PT_PLATE_PATTERNS.some((re) => re.test(compact))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Matrícula inválida (formatos: 00-00-AA, 00-AA-00, AA-00-AA)',
      });
      return z.NEVER;
    }
    // Canonical: dashes every two chars → "XX-XX-XX"
    return `${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4, 6)}`;
  });
export type LicensePlatePt = z.infer<typeof licensePlatePtSchema>;

export const vehicleCreateSchema = z.object({
  brand: registeredBrandSchema,
  model: z.string().min(1, 'Modelo obrigatório').max(80),
  year: z.coerce
    .number()
    .int()
    .min(1950, 'Ano mínimo: 1950')
    .max(CURRENT_YEAR + 1, `Ano máximo: ${CURRENT_YEAR + 1}`),
  fuel: FuelEnum,
  mileage: z.coerce.number().int().min(0, 'Quilometragem não pode ser negativa').max(2_000_000),
  vin: z.preprocess(
    (value) => typeof value === 'string' && !value.trim() ? null : value,
    z.string().trim().length(17, 'VIN deve ter 17 caracteres')
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN inválido (sem I, O, Q)').nullable().optional(),
  ),
  licensePlate: licensePlatePtSchema,
  purchasePrice: moneySchema,
  salePrice: moneySchema,
  status: VehicleStatusEnum.exclude(['RETURNED']).default('AVAILABLE'),
  acquisitionDate: z.coerce.date(),
  description: z.string().max(2000).optional(),
  pendingDocFlags: pendingDocFlagsSchema.default({
    financing: false,
    imt: false,
    registration: false,
    docs: false,
  }),
});
export type VehicleCreate = z.infer<typeof vehicleCreateSchema>;

export const vehicleUpdateSchema = vehicleCreateSchema.partial().extend({
  id: z.string().min(1),
  status: VehicleStatusEnum.optional(),
});
export type VehicleUpdate = z.infer<typeof vehicleUpdateSchema>;

export const vehicleFilterSchema = z.object({
  agedStock: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional(),
  ),
  brand: z.string().optional(),
  model: z.string().optional(),
  fuel: FuelEnum.optional(),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  mileageMin: z.coerce.number().int().optional(),
  mileageMax: z.coerce.number().int().optional(),
  status: VehicleStatusEnum.optional(),
  /**
   * Negative status filter — exclude rows of this status. Used by the main
   * /viaturas list to hide DRAFTs (they have a dedicated highlighted
   * section above the table). Ignored when `status` is also set.
   */
  notStatus: VehicleStatusEnum.optional(),
  /** Free-text — searched across brand, model, vin, licensePlate. */
  q: z.string().optional(),
});
export type VehicleFilter = z.infer<typeof vehicleFilterSchema>;
