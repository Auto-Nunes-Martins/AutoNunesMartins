import { describe, expect, it } from 'vitest';
import { sizedPhoto, vehiclePhotoSet, photoWidths, cardPhoto, cardPhotoSet } from './vehiclePhotoSources';
describe('one versioned public photo source', () => {
  it('retains the exact approved identity on every size and preload candidate', () => {
    const url = '/viaturas/car-012345abcdef/photos/2?v=' + 'a'.repeat(64);
    for (const width of photoWidths) expect(sizedPhoto(url, width)).toBe(url + '&w=1600');
    expect(vehiclePhotoSet(url)).toBeUndefined();
    expect(sizedPhoto('/viaturas/car-012345abcdef/photos/2', 320)).toBe('/viaturas/car-012345abcdef/photos/2?w=1600');
    expect(sizedPhoto('/assets/placeholder.webp', 320)).toBe('/assets/placeholder.webp');
  });
});
it('offers every supported derivative on cards without changing detail URLs or external sources', () => {
  const url = '/viaturas/car-012345abcdef/photos/0?v=' + 'b'.repeat(64);
  expect(cardPhotoSet(url)).toBe(photoWidths.map(width => `${url}&w=${width} ${width}w`).join(', '));
  expect(cardPhoto(url, 385)).toBe(url + '&w=800');
  expect(cardPhotoSet('/placeholder.webp')).toBeUndefined();
  expect(cardPhotoSet('https://example.com/image.webp')).toBeUndefined();
  expect(sizedPhoto(url, 320)).toBe(url + '&w=1600');
});
