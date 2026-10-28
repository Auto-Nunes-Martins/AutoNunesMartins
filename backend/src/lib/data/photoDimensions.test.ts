import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { publicVehicleDto, publicPhotoVersion } from './publicVehicle.js';
import { persistPhotoDimensions, removePhotoDimensions, photoDimensionVersion, withCoverPhotoDimensions } from './photoDimensions.js';

const id = 'clabcdefghijklmnopqrstuvw';
const path = `${id}/12345678-1234-1234-1234-123456789abc.jpg`;
const privatePath = `${id}/12345678-1234-1234-1234-123456789abd.jpg`;
const version = photoDimensionVersion(path);
const metadata = { width: 1600, height: 900, sourceHash: 'a'.repeat(64) };
function database() {
  return { vehiclePhotoDimensions: { createMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([{ version, width: 1600, height: 900 }]), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) } } as any;
}
const dto = (photos = [path, privatePath], approved = [path]) => publicVehicleDto({
  id, publicSlug: 'test-abcdef123456', photos, publicPhotoPaths: approved, webPublished: true,
  status: 'AVAILABLE', publicPrice: new Prisma.Decimal(100), brand: 'Test', model: 'Car', year: 2020,
  fuel: 'DIESEL', mileage: 1, publicDescription: null, publicTransmission: null,
} as any);
describe('persisted public photo dimensions', () => {
  it('uses the existing immutable version and idempotent insertion, without paths in the metadata row', async () => {
    const db = database(); expect(version).toBe(publicPhotoVersion(path));
    await persistPhotoDimensions(db, id, path, metadata);
    expect(db.vehiclePhotoDimensions.createMany).toHaveBeenCalledWith({ data: [{ version, vehicleId: id, ...metadata }], skipDuplicates: true });
    await expect(persistPhotoDimensions(db, 'different-owner', path, metadata)).rejects.toThrow();
    await expect(persistPhotoDimensions(db, id, path, { ...metadata, width: 0 })).rejects.toThrow();
  });
  it('enriches only approved current covers and explicitly allowlists returned fields', async () => {
    const db = database(); db.vehiclePhotoDimensions.findMany.mockResolvedValue([{ version, ...metadata, privatePath }]);
    const [result] = await withCoverPhotoDimensions(db, [dto()]);
    expect(result?.coverPhotoDimensions).toEqual({ version, width: 1600, height: 900 });
    expect(db.vehiclePhotoDimensions.findMany.mock.calls[0][0].where.version.in).toEqual([version]);
    expect(JSON.stringify(result)).not.toContain(privatePath);
    expect(JSON.stringify(result)).not.toContain('sourceHash');
  });
  it('does not reuse dimensions after cover replacement, reorder, while ignoring legacy subsets', async () => {
    const db = database();
    const reordered = dto([privatePath, path], [privatePath, path]);
    expect((await withCoverPhotoDimensions(db, [reordered]))[0]?.coverPhotoDimensions).toBeUndefined();
    expect((await withCoverPhotoDimensions(db, [dto([path], [])]))[0]?.coverPhotoDimensions).toEqual({width:1600,height:900,version});
    await removePhotoDimensions(db, [path]);
    expect(db.vehiclePhotoDimensions.deleteMany).toHaveBeenCalledWith({ where: { version: { in: [version] } } });
  });
  it('falls back for missing metadata or enrichment failure without bypassing the catalogue query', async () => {
    const db = database(), vehicle = dto();
    db.vehiclePhotoDimensions.findMany.mockRejectedValue({ code: 'P2021' });
    expect(await withCoverPhotoDimensions(db, [vehicle])).toEqual([vehicle]);
    db.vehiclePhotoDimensions.createMany.mockRejectedValue({ code: 'P2021' });
    expect(await persistPhotoDimensions(db, id, path, metadata)).toBe(false);
    db.vehiclePhotoDimensions.findMany.mockRejectedValue(new Error('DB offline'));
    expect(await withCoverPhotoDimensions(db, [vehicle])).toEqual([vehicle]);
    expect(await withCoverPhotoDimensions(db, [{ photos: ['/legacy'] }])).toEqual([{ photos: ['/legacy'] }]);
  });
});
