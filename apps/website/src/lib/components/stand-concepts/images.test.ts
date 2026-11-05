import { describe, expect, it } from 'vitest';
import { photo, responsivePhoto, featuredPhotoSizes, featuredPhotoSizesForRatio } from './images';

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
  it.each(['/catalog-placeholder.svg', 'https://example.com/image.jpg', 'photo-x?secret=yes'])(
    'does not fabricate variants or forward arbitrary URLs: %s',
    (path) => {
      expect(responsivePhoto(path)).toBeUndefined();
    },
  );
});

describe('authorized public photo variants', () => {
  it('uses the bounded shared widths on local public photo endpoints', () => {
    const path = '/viaturas/car-abcdef123456/photos/0';
    expect(photo(path, 1100)).toBe(path + '?w=1280');
    expect(photo(path, 336)).toBe(path + '?w=384');
    expect(responsivePhoto(path)).toContain('2560w');
    expect(responsivePhoto('https://external.example/viaturas/car/photos/0')).toBeUndefined();
  });
});

describe('featured photo preload and image cover demand', () => {
  it.each([undefined, 0, NaN, Infinity, -1, 0.75, 1.5, 1.65])(
    'preserves the existing portrait/unknown sizes for ratio %s',
    (ratio) => expect(featuredPhotoSizesForRatio(ratio)).toBe(featuredPhotoSizes),
  );
  it('includes the full wide source behind the desktop and mobile cover crop', () => {
    const sizes = featuredPhotoSizesForRatio(3);
    expect(sizes).toContain('calc(calc(100vw - 40px) * 1.621622)');
    expect(sizes).toContain('calc(43.332vw * 1.818182)');
    expect(sizes).toContain('calc(min(43.332vw, 771px) * 1.818182)');
    expect(1.621622 * 1.85).toBeGreaterThanOrEqual(3);
    expect(1.818182 * 1.65).toBeGreaterThanOrEqual(3);
  });
});
