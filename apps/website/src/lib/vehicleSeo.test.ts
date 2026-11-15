import { expect, it } from 'vitest';
import { vehicleSeo } from './vehicleSeo';
import type { PublicVehicle } from './publicVehicles';
const vehicle: PublicVehicle = {
  slug: 'audi-a3-2020-012345abcdef',
  brand: 'Audi',
  model: 'A3',
  year: 2020,
  mileage: 10000,
  fuel: 'GASOLINE',
  transmission: null,
  price: null,
  currency: 'EUR',
  description: null,
  availability: 'RESERVED',
  photos: [],
};
it('distinguishes the vehicle and keeps unknown price and reservation accurate without commercial claims', () => {
  const result = vehicleSeo(vehicle);
  expect(result.title).toContain('Audi A3 (2020)');
  expect(result.description).toContain('Gasolina');
  expect(result.description).toContain('Preço sob consulta');
  expect(result.description).toContain('Reservada.');
  expect(result.description).not.toMatch(/garantia|revisão|0 €/);
});

it('builds the search description from vehicle facts without copying the advertisement', () => {
  const result = vehicleSeo({ ...vehicle, description: 'Texto editorial exclusivo do anúncio.' });
  expect(result.description.replace(/\s/g, ' ')).toContain('2020 · 10 000 km · Gasolina.');
  expect(result.description).not.toContain('Texto editorial');
  expect(result.description).toBe(vehicleSeo({ ...vehicle, description: null }).description);
});

it('puts the public asking price in the title and keeps the compact facts in the description', () => {
  const result = vehicleSeo({ ...vehicle, price: '19950.00', availability: 'AVAILABLE' });
  expect(result.title.replace(/\s/g, ' ')).toBe('Audi A3 — 19 950 € — Auto Nunes Martins');
  expect(result.description).not.toContain('Reservada');
});
