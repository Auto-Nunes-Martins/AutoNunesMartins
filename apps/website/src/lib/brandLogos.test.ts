import { vehicleBrands } from '@anm/types';
import { expect, it } from 'vitest';
import { brandLogo } from './brandLogos';

it('uses verified local assets for exact brand names, ignoring case and outer whitespace', () => {
  expect(brandLogo(' BMW ')).toMatch(/bmw.*\.svg/);
  expect(brandLogo('Renault')).toMatch(/renault.*\.svg/);
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

it('resolves a Nissan stored as legacy text without requiring an edit or a catalogue relation in the API', () => {
  expect(brandLogo('  nIsSaN  ')).toMatch(/nissan.*\.svg/);
  expect(brandLogo('Nissan')).toBe(brandLogo('  nIsSaN  '));
});
it.each(vehicleBrands)(
  'matches public logo coverage to the installed catalogue: $name',
  (brand) => {
    if (brand.logo) expect(brandLogo(brand.name)).toMatch(/\.(?:svg|png)/);
    else expect(brandLogo(brand.name)).toBeUndefined();
    for (const alias of brand.aliases) expect(brandLogo(alias)).toBe(brandLogo(brand.name));
  },
);
