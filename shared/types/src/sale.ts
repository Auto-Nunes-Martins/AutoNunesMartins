import { z } from 'zod';
import { BuyerTypeEnum, DeliveryStatusEnum, FuelEnum, TradeInDispositionEnum } from './enums.js';
import { moneySchema } from './decimal.js';
import { licensePlatePtSchema, pendingDocFlagsSchema, vehicleCreateSchema } from './vehicle.js';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/**
 * A car the customer hands over as partial payment, recorded inline on the
 * sale-creation request. The backend persists it as a `TradeIn` row tied to
 * the new `Sale` as a separate acquisition and (when `disposition === 'STOCK'`)
 * creates a fresh `Vehicle` row in inventory so the car can be re-sold later.
 *
 * Stock identification follows the main vehicle form: plate required, VIN
 * optional. SCRAP does not create inventory and may omit both identifiers.
 */
export const tradeInCreateSchema = z
  .object({
    brand: z.string().trim().min(1, 'Marca obrigatória').max(60),
    model: z.string().trim().min(1, 'Modelo obrigatório').max(80),
    year: vehicleCreateSchema.shape.year,
    fuel: vehicleCreateSchema.shape.fuel,
    mileage: z.preprocess(emptyToUndefined, vehicleCreateSchema.shape.mileage),
    licensePlate: z.preprocess(emptyToUndefined, licensePlatePtSchema.optional()),
    vin: vehicleCreateSchema.shape.vin,
    allowanceValue: moneySchema.refine(
      (value) => Number(value) >= 0,
      'O valor da retoma não pode ser negativo.',
    ),
    disposition: TradeInDispositionEnum,
    notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
    pendingDocFlags: pendingDocFlagsSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.disposition === 'STOCK' && !val.licensePlate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['licensePlate'],
        message: 'Matrícula obrigatória quando a viatura entra no stock.',
      });
    }
  });
export type TradeInCreate = z.infer<typeof tradeInCreateSchema>;

export const saleCreateSchema = z.object({
  vehicleId: z.string().min(1),
  customerId: z.string().min(1),
  salePrice: moneySchema,
  saleDate: z.coerce.date(),
  deliveryDate: z.coerce.date().optional(),
  deliveryStatus: DeliveryStatusEnum.default('PENDING'),
  /**
   * Manual extra income for the sale. Typical use: a referral commission
   * paid by a credit institution when the customer financed the purchase
   * through them. Optional; defaults to "0" so existing callers keep
   * working without change.
   */
  commission: moneySchema.optional().default('0'),
  /**
   * Tax regime selector. PARTICULAR (default) applies the 23/123 margin
   * scheme; COMERCIANTE marks a B2B sale with no VAT discriminated by
   * the seller, so the full margin lands in `realProfit`.
   */
  buyerType: BuyerTypeEnum.default('PARTICULAR'),
  /**
   * Optional trade-in, recorded as a separate acquisition without changing
   * this sale's margin/VAT. STOCK creates a new draft Vehicle linked to it.
   */
  tradeIn: tradeInCreateSchema.optional(),
});
export type SaleCreate = z.infer<typeof saleCreateSchema>;

export const saleCancellationDecisionSchema = z
  .object({
    reason: z.string().trim().min(3, 'Indique o motivo (3 a 500 caracteres).').max(500),
    operation: z.enum(['CANCEL', 'DELETE']).optional(),
    tradeInAction: z.enum(['RETURN', 'KEEP', 'DELETE']).optional(),
    independentAcquisitionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indique a data de aquisição.')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }, 'Data de aquisição inválida.')
      .optional(),
    independentPurchasePrice: moneySchema
      .refine(
        (value) => Number(value) >= 0 && Number(value) <= 9999999999.99,
        'O valor deve ser entre 0 e 9 999 999 999,99 €.',
      )
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.tradeInAction === 'KEEP' && value.independentPurchasePrice === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['independentPurchasePrice'],
        message: 'Confirme o valor de aquisição independente da retoma.',
      });
    }
    if (value.tradeInAction !== 'KEEP' && value.independentPurchasePrice !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['independentPurchasePrice'],
        message: 'O valor de aquisição aplica-se apenas à retoma mantida.',
      });
    }
    if (value.tradeInAction !== 'KEEP' && value.independentAcquisitionDate !== undefined)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['independentAcquisitionDate'],
        message: 'A data de aquisição aplica-se à retoma mantida.',
      });
    if (value.tradeInAction === 'DELETE' && value.operation !== 'DELETE')
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tradeInAction'],
        message: 'Só pode eliminar uma retoma criada por engano ao corrigir o registo da venda.',
      });
  });
export const saleCancellationSchema = z
  .object({
    decision: saleCancellationDecisionSchema,
    confirmed: z.literal(true),
    reviewToken: z.string().min(1),
    deletionConfirmation: z.literal('ELIMINAR').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision.operation === 'DELETE' && value.deletionConfirmation !== 'ELIMINAR')
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deletionConfirmation'],
        message: 'Confirme a eliminação na revisão final.',
      });
  });
export type SaleCancellationDecision = z.infer<typeof saleCancellationDecisionSchema>;
export type SaleCancellation = z.infer<typeof saleCancellationSchema>;

/** Shape returned by the API for an existing trade-in on a sale. */
export const tradeInSchema = z.object({
  id: z.string(),
  saleId: z.string(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int(),
  fuel: FuelEnum,
  mileage: z.number().int(),
  licensePlate: z.string().nullable(),
  vin: z.string().nullable(),
  allowanceValue: moneySchema,
  disposition: TradeInDispositionEnum,
  resultingVehicleId: z.string().nullable(),
  notes: z.string().nullable(),
});
export type TradeIn = z.infer<typeof tradeInSchema>;

export const saleUpdateSchema = saleCreateSchema.partial().extend({
  id: z.string().min(1),
});
export type SaleUpdate = z.infer<typeof saleUpdateSchema>;

export const saleFiguresSchema = z.object({
  salePrice: moneySchema,
  purchasePrice: moneySchema,
  expensesTotal: moneySchema,
  margin: moneySchema,
  vatAmount: moneySchema,
  /**
   * Same `commission` value persisted on the Sale row, surfaced in figures
   * so callers can render it as its own line in the profit breakdown.
   */
  commission: moneySchema,
  realProfit: moneySchema,
});
export type SaleFigures = z.infer<typeof saleFiguresSchema>;
