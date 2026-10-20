import { expect, it } from 'vitest';
import { brandLogo } from './brandLogos';
import bmw from './assets/images/brands/bmw.svg?url&no-inline';
import renault from './assets/images/brands/renault.svg?url&no-inline';

it('uses verified local assets for exact brand names, ignoring case and outer whitespace', () => {
  expect(brandLogo(' BMW ')).toBe(bmw);
  expect(brandLogo('Renault')).toBe(renault);
});
it.each(['renot', 'Renault Trucks', 'Inventada', '__proto__', 'constructor', '../renault'])(
  'does not guess a logo for %s',
  (name) => {
    expect(brandLogo(name)).toBeUndefined();
  },
);
it.each([
  'Audi',
  'BMW',
  'Citroën',
  'Dacia',
  'Fiat',
  'Kia',
  'Mercedes-Benz',
  'Opel',
  'Peugeot',
  'Porsche',
  'Renault',
  'Tesla',
  'Toyota',
  'Volkswagen',
])('covers the current demo inventory brand %s', (name) => {
  expect(brandLogo(name)).toMatch(/\.svg/);
});
it('accepts explicit brand aliases without fuzzy matching', () => {
  expect(brandLogo(' Mercedes   Benz ')).toBe(brandLogo('Mercedes-Benz'));
  expect(brandLogo('MERCEDES')).toBe(brandLogo('Mercedes-Benz'));
  expect(brandLogo('Citroen')).toBe(brandLogo('Citroën'));
  expect(brandLogo(' VW ')).toBe(brandLogo('Volkswagen'));
});
