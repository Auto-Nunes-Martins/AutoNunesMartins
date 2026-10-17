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
    '/catalog-placeholder.svg',
    'https://example.com/image.jpg',
    'photo-x?secret=yes',
  ])('does not fabricate variants or forward arbitrary URLs: %s', (path) => {
    expect(responsivePhoto(path)).toBeUndefined();
  });
});

describe('authorized public photo variants',()=>{
  it('uses the bounded shared widths on local public photo endpoints',()=>{
    const path='/viaturas/car-abcdef123456/photos/0';
    expect(photo(path,1100)).toBe(path+'?w=1600');
    expect(responsivePhoto(path)).toBe([320,800,1600,2560].map(w=>`${path}?w=${w} ${w}w`).join(', '));
    expect(responsivePhoto('https://external.example/viaturas/car/photos/0')).toBeUndefined();
  });
});
