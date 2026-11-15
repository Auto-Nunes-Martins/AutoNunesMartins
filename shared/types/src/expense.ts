import { z } from 'zod';
import { OpExpenseCategoryEnum, VehicleExpenseCategoryEnum } from './enums.js';
import { moneySchema } from './decimal.js';

/** Explicit document dates: never coerce null, a number or an empty value to 1970. */
export const fiscalDateSchema = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/)])
  .pipe(z.coerce.date());

export const vehicleExpenseCreateSchema = z.object({
  vehicleId: z.string().min(1),
  category: VehicleExpenseCategoryEnum,
  description: z.string().min(1, 'Descrição obrigatória').max(240),
  amount: moneySchema,
  vatAmount: moneySchema.nullable().optional(),
  vatDate: fiscalDateSchema.nullable().optional(),
  date: z.coerce.date(),
  confirmedOnSold: z.boolean().optional(),
});
export type VehicleExpenseCreate = z.infer<typeof vehicleExpenseCreateSchema>;

export const vehicleExpenseUpdateSchema = vehicleExpenseCreateSchema.partial().extend({
  id: z.string().min(1),
});
export type VehicleExpenseUpdate = z.infer<typeof vehicleExpenseUpdateSchema>;

export const operationalExpenseCreateSchema = z.object({
  category: OpExpenseCategoryEnum,
  description: z.string().min(1, 'Descrição obrigatória').max(240),
  amount: moneySchema,
  date: z.coerce.date(),
});
export type OperationalExpenseCreate = z.infer<typeof operationalExpenseCreateSchema>;

export const operationalExpenseUpdateSchema = operationalExpenseCreateSchema.partial().extend({
  id: z.string().min(1),
});
export type OperationalExpenseUpdate = z.infer<typeof operationalExpenseUpdateSchema>;
