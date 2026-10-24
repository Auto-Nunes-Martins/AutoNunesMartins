import { describe, expect, it } from 'vitest';
import { sizedPhoto, vehiclePhotoSet, photoWidths } from './vehiclePhotoSources';
describe('versioned responsive photo sources', () => {
  it('retains the exact approved identity on every size and preload candidate', () => {
    const url = '/viaturas/car-012345abcdef/photos/2?v=' + 'a'.repeat(64);
    expect(sizedPhoto(url, 1280)).toBe(url + '&w=1280');
    expect(vehiclePhotoSet(url)).toBe(photoWidths.map(width => url + '&w=' + width + ' ' + width + 'w').join(', '));
    expect(sizedPhoto('/viaturas/car-012345abcdef/photos/2', 320)).toBe('/viaturas/car-012345abcdef/photos/2?w=320');
    expect(sizedPhoto('/assets/placeholder.webp', 320)).toBe('/assets/placeholder.webp');
  });
});
