import { describe, expect, it } from 'vitest';
import { photo, responsivePhoto } from './images';

describe('vehicle photo URLs', () => {
  it('expands only curated Unsplash identifiers', () => {
    expect(photo('photo-1503376780353-7e6692767b70', 1100)).toBe(
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1100&q=85',
    );
  });
  it.each([
    '/catalog-placeholder.svg',
    '/_app/immutable/assets/catalog-placeholder.hash.svg',
    'https://stand.example/_app/immutable/assets/catalog-placeholder.hash.svg',
    'http://localhost:5173/src/lib/assets/catalog-placeholder.svg?url&no-inline',
    '../assets/catalog-placeholder.hash.svg',
    '/viaturas/car-abcdef123456/photos/0',
  ])('preserves local imports and public photo paths: %s', (url) => {
    expect(photo(url, 1100)).toBe(url);
    expect(responsivePhoto(url)).toBeUndefined();
  });
});

describe('responsive demo images', () => {
  it('offers real CDN variants with bounded widths', () => {
    const result = responsivePhoto('photo-1503376780353-7e6692767b70', 1280)!;
    expect(result).toContain('w=320&q=80 320w');
    expect(result).toContain('w=1280&q=80 1280w');
    expect(result).not.toContain('1920w');
  });
  it.each([
    '/api/public/vehicles/car/photos/0',
    '/catalog-placeholder.svg',
    'https://example.com/image.jpg',
    'photo-x?secret=yes',
  ])('does not fabricate variants or forward arbitrary URLs: %s', (path) => {
    expect(responsivePhoto(path)).toBeUndefined();
  });
});
