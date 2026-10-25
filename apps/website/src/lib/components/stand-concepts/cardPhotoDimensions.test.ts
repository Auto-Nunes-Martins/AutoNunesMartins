import { describe, it, expect } from 'vitest';
import { cardImageSizes, publicCardImageSizes } from './images';
import { publicCard, publicVehicleSchema } from '$lib/publicVehicles';
const version = 'a'.repeat(64);
const vehicle = { slug: 'test-abcdef123456', brand: 'Test', model: 'Car', year: 2020, fuel: 'DIESEL', mileage: 1, price: '100.00', currency: 'EUR', description: null, transmission: null, availability: 'AVAILABLE', photos: [`/api/public/vehicles/test-abcdef123456/photos/0?v=${version}`] };
describe('public mobile cover source selection', () => {
  it.each([[320, 2], [412, 1.75], [700, 2]])('supplies enough pixels at width %s without multiplying DPR twice', (width, dpr) => {
    for (const ratio of [0.75, 4 / 3, 1.93, 2.09, 3]) {
      const sizes = publicCardImageSizes({ width: ratio * 1000, height: 1000 });
      const match = [...sizes.matchAll(/calc\(([\d.]+)vw \+ ([\d.]+)px\)/g)][1]!;
      const selectedCssWidth = Math.max(width * .9, Number(match[1]) * width / 100 + Number(match[2]));
      const requiredCssWidth = Math.max(width * .9, (width * .9 / 1.4 + 60) * ratio);
      expect(Math.abs(selectedCssWidth * dpr - requiredCssWidth * dpr)).toBeLessThan(.001);
    }
  });
  it('preserves desktop/legacy fallback and chooses 800 for 4:3 but 1280 for the wide cover', () => {
    expect(publicCardImageSizes()).toBe(cardImageSizes);
    expect(publicCardImageSizes({ width: 0, height: 1 })).toBe(cardImageSizes);
    expect(publicCardImageSizes({ width: 4, height: 3 })).toContain('(max-width: 1050px) 46vw');
    const choose = (ratio: number) => [320, 384, 800, 1280, 1600, 2560].find(w => w >= Math.max(412 * .9, (412 * .9 / 1.4 + 60) * ratio) * 1.75);
    expect(choose(4 / 3)).toBe(800); expect(choose(2.09)).toBe(1280);
  });
  it('accounts for the two-column catalogue at 541–700px without applying that grid to home', () => {
    const catalog = publicCardImageSizes({ width: 2, height: 1 }, true);
    expect(catalog).toContain('(max-width: 540px)');
    expect(catalog).toContain('calc(45vw + -12px)');
    expect(publicCardImageSizes({ width: 2, height: 1 })).not.toContain('45vw');
  });
  it('accepts metadata only for the current first-photo version and tolerates old/malformed responses', () => {
    const parse = (coverPhotoDimensions?: unknown) => publicCard(publicVehicleSchema.parse({ ...vehicle, coverPhotoDimensions }));
    expect(parse().photoDimensions).toBeUndefined();
    expect(parse({ version, width: 1600, height: 900 }).photoDimensions).toMatchObject({ version, width: 1600, height: 900 });
    expect(parse({ version: 'b'.repeat(64), width: 1600, height: 900 }).photoDimensions).toBeUndefined();
    expect(parse({ version, width: -1, height: 900 }).photoDimensions).toBeUndefined();
    expect(parse({ version, width: 100000, height: 100000 }).photoDimensions).toBeUndefined();
  });
});
