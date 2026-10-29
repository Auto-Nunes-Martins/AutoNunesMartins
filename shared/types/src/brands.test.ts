import { describe, it, expect } from 'vitest';
import {
  vehicleBrands,
  brandSearchKey,
  registeredBrandSchema,
  searchVehicleBrands,
} from './brands.js';
import { vehicleCreateSchema, vehicleUpdateSchema } from './vehicle.js';
import { tradeInCreateSchema } from './sale.js';
describe('registered brands', () => {
  it('normalizes explicit aliases, accents, case and spacing without fuzzy remapping', () => {
    for (const [raw, name] of [
      [' vw ', 'Volkswagen'],
      ['CITROEN', 'Citroën'],
      ['škODA', 'Škoda'],
      ['mercedes benz', 'Mercedes-Benz'],
      ['KGM', 'KG Mobility'],
    ])
      expect(registeredBrandSchema.parse(raw)).toBe(name);
    expect(searchVehicleBrands('renalt').map((x) => x.name)).toContain('Renault');
    for (const raw of ['Renalt', 'Other', 'Outros', '', 'Brand new brand'])
      expect(registeredBrandSchema.safeParse(raw).success).toBe(false);
  });
  it('has unique normalized names and aliases and broad portal coverage', () => {
    const owners = new Map<string, string>();
    for (const brand of vehicleBrands)
      for (const label of [brand.name, ...brand.aliases]) {
        const key = brandSearchKey(label);
        expect(owners.get(key) ?? brand.name).toBe(brand.name);
        owners.set(key, brand.name);
      }
    expect(vehicleBrands.length).toBeGreaterThan(180);
    for (const name of ['ALPINA', 'Firefly', 'DFSK', 'XEV', 'Togg', 'Aixam', 'Cupra', 'SsangYong'])
      expect(registeredBrandSchema.parse(name)).toBe(name);
  });
  it('rejects non-catalogue values on create, edit and trade-in API contracts', () => {
    expect(vehicleCreateSchema.shape.brand.safeParse('arbitrary').success).toBe(false);
    expect(vehicleUpdateSchema.safeParse({ id: 'a', brand: 'arbitrary' }).success).toBe(false);
    expect(
      tradeInCreateSchema.safeParse({
        brand: 'arbitrary',
        model: 'X',
        year: 2020,
        fuel: 'DIESEL',
        mileage: 1,
        allowanceValue: '100',
        disposition: 'SCRAP',
      }).success,
    ).toBe(false);
  });
});
