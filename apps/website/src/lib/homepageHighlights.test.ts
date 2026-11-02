import { describe, expect, it } from 'vitest';
import { highlightPhotoDimensions } from './homepageHighlights';
import type { PublicVehicle } from './publicVehicles';

const version = 'a'.repeat(64);
const dimensions = { version, width: 3072, height: 1024 };
const vehicle = (): PublicVehicle => ({
  slug: 'car-012345abcdef',
  brand: 'BMW',
  model: 'One',
  year: 2021,
  fuel: 'DIESEL',
  mileage: 40000,
  price: '23500.00',
  currency: 'EUR',
  description: null,
  transmission: null,
  availability: 'AVAILABLE',
  photos: [`/api/public/vehicles/car-012345abcdef/photos/0?v=${version}`],
});

describe('homepage photo metadata already loaded with stock', () => {
  it('reuses a matching stock hint without mutating either response', () => {
    const item = { vehicle: vehicle(), photoIndex: 0 };
    const stock = [{ ...vehicle(), coverPhotoDimensions: dimensions }];
    expect(highlightPhotoDimensions(item, stock)).toBe(dimensions);
    expect(item.vehicle.coverPhotoDimensions).toBeUndefined();
    expect(stock[0]?.coverPhotoDimensions).toBe(dimensions);
  });

  it.each(['slug', 'photo', 'version', 'index'] as const)('rejects a different %s', (mismatch) => {
    const item = { vehicle: vehicle(), photoIndex: mismatch === 'index' ? 1 : 0 };
    const stock = { ...vehicle(), coverPhotoDimensions: { ...dimensions } };
    if (mismatch === 'slug') stock.slug = 'other-012345abcdef';
    if (mismatch === 'photo') stock.photos = [stock.photos[0]!.replace('/photos/0', '/photos/1')];
    if (mismatch === 'version') stock.coverPhotoDimensions.version = 'b'.repeat(64);
    expect(highlightPhotoDimensions(item, [stock])).toBeUndefined();
  });

  it('does not use cover dimensions for a different selected photo', () => {
    const other = `/api/public/vehicles/car-012345abcdef/photos/1?v=${'b'.repeat(64)}`;
    const selected = { ...vehicle(), photos: [...vehicle().photos, other] };
    expect(
      highlightPhotoDimensions({ vehicle: selected, photoIndex: 1 }, [
        { ...selected, coverPhotoDimensions: dimensions },
      ]),
    ).toBeUndefined();
  });

  it('prefers matching selected-photo dimensions, including a non-cover index', () => {
    const second = { version: 'b'.repeat(64), width: 800, height: 1200 };
    const selected = {
      ...vehicle(),
      photos: [
        ...vehicle().photos,
        `/api/public/vehicles/car-012345abcdef/photos/1?v=${second.version}`,
      ],
      photoDimensions: [null, second],
    };
    expect(highlightPhotoDimensions({ vehicle: selected, photoIndex: 1 })).toBe(second);
  });

  it.each([
    { width: 0, height: 100 },
    { width: 1.5, height: 100 },
    { width: Infinity, height: 100 },
    { width: 25000, height: 1000 },
  ])('ignores invalid dimensions %j', (invalid) => {
    expect(
      highlightPhotoDimensions({
        vehicle: { ...vehicle(), coverPhotoDimensions: { version, ...invalid } },
        photoIndex: 0,
      }),
    ).toBeUndefined();
  });

  it('keeps the legacy fallback when stock or metadata is absent', () => {
    expect(highlightPhotoDimensions({ vehicle: vehicle(), photoIndex: 0 })).toBeUndefined();
    expect(highlightPhotoDimensions(undefined, [vehicle()])).toBeUndefined();
  });

  it('ignores an unversioned hint and can replace a stale own hint with matching stock data', () => {
    const unversioned = {
      ...vehicle(),
      photos: ['/api/public/vehicles/car-012345abcdef/photos/0'],
      coverPhotoDimensions: { ...dimensions, version: '' },
    };
    expect(highlightPhotoDimensions({ vehicle: unversioned, photoIndex: 0 })).toBeUndefined();
    const stale = {
      ...vehicle(),
      coverPhotoDimensions: { ...dimensions, version: 'b'.repeat(64) },
    };
    expect(
      highlightPhotoDimensions({ vehicle: stale, photoIndex: 0 }, [
        { ...vehicle(), coverPhotoDimensions: dimensions },
      ]),
    ).toBe(dimensions);
  });
});
