import { describe, expect, it } from 'vitest';
import { creationDetailsIssues, creationStatus, vehicleDetailsFromForm } from './creationFlow';
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    brand: 'Dacia',
    model: 'Jogger',
    year: '2023',
    fuel: 'GASOLINE',
    mileage: '10000',
    vin: 'VF1AAAAAAAAAAAAAA',
    purchasePrice: '10000',
    salePrice: '15000',
    licensePlate: 'AA-00-AA',
    status: 'AVAILABLE',
    acquisitionDate: '2026-10-23',
  }))
    data.set(key, value);
  return data;
};
describe('creation workflow intents and required data', () => {
  it('keeps a saved draft outside the definitive stock independently of the intended status', () => {
    expect(creationStatus('draft', 'RESERVED')).toBe('DRAFT');
    expect(creationStatus('crm', 'RESERVED')).toBe('RESERVED');
    expect(creationStatus('publish', 'AVAILABLE')).toBe('AVAILABLE');
  });
  it('requires plate and selling price but permits missing VIN', () => {
    expect(creationDetailsIssues(vehicleDetailsFromForm(form()))).toEqual([]);
    const missing = form();
    missing.delete('vin');
    expect(creationDetailsIssues(vehicleDetailsFromForm(missing))).toEqual([]);
    missing.delete('licensePlate');
    missing.delete('salePrice');
    missing.delete('brand');
    expect(
      creationDetailsIssues(vehicleDetailsFromForm(missing)).map((issue) => issue.key),
    ).toEqual(expect.arrayContaining(['licensePlate', 'salePrice', 'brand']));
  });
  it('normalizes draft fields and retains the chosen status without implicitly publishing', () => {
    const data = form();
    data.set('vin', 'vf1aaaaaaaaaaaaaa');
    data.set('pendingDocFlags.docs', 'true');
    expect(vehicleDetailsFromForm(data)).toMatchObject({
      vin: 'VF1AAAAAAAAAAAAAA',
      licensePlate: 'AA-00-AA',
      status: 'AVAILABLE',
      pendingDocFlags: { docs: true, registration: false },
    });
    expect(vehicleDetailsFromForm(data)).not.toHaveProperty('published');
  });
});
