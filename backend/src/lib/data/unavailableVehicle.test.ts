import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { readUnavailableVehicle, unavailableVehiclePhotoPath } from './unavailableVehicle.js';

const id = 'c' + '1'.repeat(24),
  slug = 'tesla-model-s-2022-abcdef123456';
const photo = `${id}/12345678-1234-1234-1234-123456789abc.webp`;
const findUnique = vi.fn();
const db = { vehicle: { findUnique } } as unknown as PrismaClient;
const vehicle = () => ({
  id,
  publicSlug: slug,
  brand: 'Tesla',
  model: 'Model S',
  year: 2022,
  fuel: 'ELECTRIC',
  mileage: 20000,
  publicTransmission: 'AUTOMATIC',
  photos: [photo],
  webPublished: false,
  status: 'AVAILABLE',
  soldDate: null,
  sale: null,
  vin: 'PRIVATE_VIN',
  purchasePrice: 'PRIVATE_PURCHASE',
  publicPrice: 'OLD_PRICE',
});
beforeEach(() => {
  findUnique.mockReset();
  findUnique.mockResolvedValue(vehicle());
});

describe('unavailable listing from the existing vehicle', () => {
  it('uses current identity and photo without archive authorization or stored pixels', async () => {
    expect(await readUnavailableVehicle(db, slug)).toEqual({
      slug,
      brand: 'Tesla',
      model: 'Model S',
      year: 2022,
      summary: 'Tesla Model S de 2022, elétrico, com 20 000 km e caixa automática.',
      photo: `/viaturas/${slug}/indisponivel/foto`,
    });
    expect(await unavailableVehiclePhotoPath(db, slug)).toBe(photo);
    expect(findUnique.mock.calls[0]![0].where).toEqual({ publicSlug: slug });
    const query = findUnique.mock.calls[0]![0];
    expect(query.select).not.toHaveProperty('vin');
    expect(query.select).not.toHaveProperty('purchasePrice');
  });
  it('shows available identity without an image, and follows replacement/removal immediately', async () => {
    findUnique.mockResolvedValue({ ...vehicle(), photos: [] });
    expect((await readUnavailableVehicle(db, slug))?.photo).toBeNull();
    expect(await unavailableVehiclePhotoPath(db, slug)).toBeNull();
    const replacement = photo.replace('9abc', '9abd');
    findUnique.mockResolvedValue({ ...vehicle(), photos: [replacement] });
    expect(await unavailableVehiclePhotoPath(db, slug)).toBe(replacement);
    findUnique.mockResolvedValue(null);
    expect(await readUnavailableVehicle(db, slug)).toBeNull();
    expect(await unavailableVehiclePhotoPath(db, slug)).toBeNull();
  });
  it('does not expose a different vehicle, an active listing or another storage namespace', async () => {
    findUnique.mockResolvedValue({ ...vehicle(), publicSlug: 'another-abcdef123456' });
    expect(await readUnavailableVehicle(db, slug)).toBeNull();
    findUnique.mockResolvedValue({ ...vehicle(), webPublished: true });
    expect(await unavailableVehiclePhotoPath(db, slug)).toBeNull();
    findUnique.mockResolvedValue({
      ...vehicle(),
      photos: ['another/12345678-1234-1234-1234-123456789abc.webp'],
    });
    expect((await readUnavailableVehicle(db, slug))?.photo).toBeNull();
    expect(await unavailableVehiclePhotoPath(db, slug)).toBeNull();
  });
  it('keeps sold and returned vehicles identifiable while the vehicle exists', async () => {
    for (const status of ['SOLD', 'DELIVERED', 'RETURNED']) {
      findUnique.mockResolvedValue({
        ...vehicle(),
        status,
        webPublished: true,
        sale: status === 'RETURNED' ? null : { id: 'sale' },
      });
      expect((await readUnavailableVehicle(db, slug))?.model).toBe('Model S');
    }
  });
});
