import { describe, expect, it } from 'vitest';
import { tradeInCreateSchema } from './sale.js';

const stock = {
  brand: 'Renault',
  model: 'Clio',
  year: 2018,
  fuel: 'DIESEL',
  mileage: 120000,
  licensePlate: '12ab34',
  allowanceValue: '4000',
  disposition: 'STOCK',
};
describe('trade-in identification and initial intake', () => {
  it('creates stock intake without VIN, photos, public fields or resale price', () => {
    expect(tradeInCreateSchema.parse(stock)).toMatchObject({ licensePlate: '12-AB-34' });
    expect(tradeInCreateSchema.parse({ ...stock, vin: '' }).vin).toBeNull();
  });
  it('requires a plate for stock even when a VIN is supplied', () => {
    const result = tradeInCreateSchema.safeParse({
      ...stock,
      licensePlate: '',
      vin: 'VF1AAAAAAAAAAAAAA',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]!.path).toEqual(['licensePlate']);
  });
  it('keeps scrap identifiers optional but validates identifiers when supplied', () => {
    expect(
      tradeInCreateSchema.safeParse({ ...stock, disposition: 'SCRAP', licensePlate: '' }).success,
    ).toBe(true);
    for (const fields of [{ licensePlate: 'invalid' }, { vin: 'invalid' }]) {
      expect(tradeInCreateSchema.safeParse({ ...stock, ...fields }).success).toBe(false);
    }
  });
  it('requires explicit mileage, fuel and allowance, permitting recorded zeros', () => {
    for (const fields of [
      { mileage: '' },
      { fuel: '' },
      { allowanceValue: '' },
      { allowanceValue: '-1' },
      { mileage: 2000001 },
    ]) {
      expect(tradeInCreateSchema.safeParse({ ...stock, ...fields }).success).toBe(false);
    }
    expect(
      tradeInCreateSchema.safeParse({ ...stock, mileage: 0, allowanceValue: '0' }).success,
    ).toBe(true);
  });
  it('accepts the existing document checklist and optional intake notes', () => {
    expect(
      tradeInCreateSchema.parse({
        ...stock,
        notes: 'Revisão em falta',
        pendingDocFlags: { docs: true },
      }),
    ).toMatchObject({
      notes: 'Revisão em falta',
      pendingDocFlags: { financing: false, imt: false, registration: false, docs: true },
    });
  });
});
