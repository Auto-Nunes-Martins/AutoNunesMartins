import { expect, it } from 'vitest';
import { brandLogo } from './brandLogos';
import bmw from './assets/images/brands/bmw.svg?url&no-inline';
import renault from './assets/images/brands/renault.svg?url&no-inline';

it('uses verified local assets for exact brand names, ignoring case and outer whitespace', () => {
  expect(brandLogo(' BMW ')).toBe(bmw);
  expect(brandLogo('Renault')).toBe(renault);
});
it.each(['renot', 'Renault Trucks', 'Inventada', '__proto__', 'constructor', '../renault'])('does not guess a logo for %s', name => {
  expect(brandLogo(name)).toBeUndefined();
});
