import { describe, expect, it } from 'vitest';
import { customerCreateSchema, customerUpdateSchema } from './customer.js';

const customer = { name: 'Cliente Teste', nif: '123456789' };

describe('customer phone numbers', () => {
  it.each([
    ['912345678', '912345678'],
    ['+351 912 345 678', '+351912345678'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0033 6 12 34 56 78', '+33612345678'],
    ['+34 612 345 678', '+34612345678'],
    ['0034 612-345-678', '+34612345678'],
    ['+44 7700 900123', '+447700900123'],
    ['+1 (202) 555-0123', '+12025550123'],
    ['+55 (11) 91234-5678', '+5511912345678'],
    ['  +33\u00a06.12.34.56.78  ', '+33612345678'],
    ['0612345678', '0612345678'],
    ['+123456789012345', '+123456789012345'],
  ])('accepts and normalizes %s on creation and editing', (phone, normalized) => {
    expect(customerCreateSchema.parse({ ...customer, phone }).phone).toBe(normalized);
    expect(customerUpdateSchema.parse({ id: 'customer', phone }).phone).toBe(normalized);
    // CRM and API both parse the same data, so normalization must be idempotent.
    expect(customerCreateSchema.parse({ ...customer, phone: normalized }).phone).toBe(normalized);
  });

  it.each([
    '',
    ' ',
    '123456',
    '+1234567890123456',
    '+0123456789',
    '++33612345678',
    '33+612345678',
    '912abc345678',
    '+33 6 12 34 56 78 ext 9',
    '---',
    '1'.repeat(41),
  ])('rejects malformed phone %s with a field error', (phone) => {
    const parsed = customerCreateSchema.safeParse({ ...customer, phone });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.path).toEqual(['phone']);
  });

  it('allows editing other fields without supplying a phone', () => {
    expect(customerUpdateSchema.parse({ id: 'customer', name: 'Novo nome' })).not.toHaveProperty(
      'phone',
    );
  });
});
