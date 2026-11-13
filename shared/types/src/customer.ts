import { z } from 'zod';
import { nifSchema } from './nif.js';

// Accept common pasted formats without guessing a country for national numbers.
const customerPhoneSchema = z
  .string()
  .trim()
  .max(40, 'Telefone demasiado longo')
  .regex(
    /^\+?[0-9\s().-]+$/,
    'Telefone inválido. Utilize números e, se necessário, o indicativo internacional.',
  )
  .transform((value) => value.replace(/[\s().-]/g, '').replace(/^00/, '+'))
  .pipe(
    z
      .string()
      .regex(
        /^(?:\d{7,15}|\+[1-9]\d{6,14})$/,
        'Telefone deve ter entre 7 e 15 dígitos, incluindo o indicativo.',
      ),
  );

export const customerCreateSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório').max(120),
  phone: customerPhoneSchema,
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined)),
  address: z.string().max(240).optional(),
  nif: nifSchema,
  notes: z.string().max(4000).optional(),
});
export type CustomerCreate = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  id: z.string().min(1),
});
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>;
