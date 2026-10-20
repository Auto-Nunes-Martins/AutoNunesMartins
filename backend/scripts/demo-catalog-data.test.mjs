import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDemoVehicle, catalogState, stable, demoMarker, mutableFields } from './demo-catalog-data.mjs';
const row = { id: 'fixture', brand: 'Audi', model: 'Q5 50 TFSI e quattro', fuel: 'PLUGIN_HYBRID', year: 2023, mileage: 90000, publicPrice: '49900', publicSpecifications: null };
test('Q5 separates explicit model/version and the second plan is identical', () => {
  const after = planDemoVehicle(row);
  assert.equal(after.model, 'Q5'); assert.equal(after.publicSpecifications.version, '50 TFSI e quattro');
  assert.equal(after.publicTransmission, 'AUTOMATIC');
  assert.equal(stable(planDemoVehicle({ ...row, ...after })), stable(after));
  assert(after.publicDescription.startsWith(demoMarker));
  assert.deepEqual(Object.keys(after).sort(), [...mutableFields].sort());
});
test('explicitly replaces fake examples, keeps price and approved equipment, never invents an unknown model', () => {
  const fake = planDemoVehicle({ ...row, brand: 'renot', model: 'clicli', year: 2000, fuel: 'GASOLINE', publicPrice: null });
  assert.equal(fake.brand, 'Renault'); assert.equal(fake.model, 'Clio'); assert.equal(fake.publicSpecifications.version, '1.2 Alizé');
  assert.equal(fake.publicPrice, '3900.00');
  const approved = planDemoVehicle({ ...row, publicSpecifications: { color: 'Prata', equipment: ['Navegação'] } });
  assert.equal(approved.publicPrice, '49900.00'); assert.deepEqual(approved.publicSpecifications.equipment, ['Navegação']);
  assert.equal(approved.publicSpecifications.color, 'Prata');
  assert.throws(() => planDemoVehicle({ ...row, model: 'Unknown' }), /No explicit demo mapping/);
  assert.throws(() => planDemoVehicle({ ...row, fuel: 'ELECTRIC' }), /Unexpected base data/);
});
test('backup catalog projection excludes operational and private fields', () => {
  const state = catalogState({ ...row, vin: 'PRIVATE', purchasePrice: 123, photos: ['secret'], status: 'SOLD', publicSlug: 'fixed' });
  assert(!stable(state).includes('PRIVATE')); assert(!('purchasePrice' in state)); assert(!('photos' in state));
  assert.equal(state.publicPrice, '49900.00');
});
