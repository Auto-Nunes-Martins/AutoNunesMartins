import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), warn: vi.fn() }));
vi.mock('./photoVariants.js', () => ({ readVariantManifests: mocks.read }));
vi.mock('../../logger.js', () => ({ logger: { warn: mocks.warn } }));
import { preparePhotoDimensions } from './preparePhotoDimensions.js';
import { photoDimensionVersion } from '../data/photoDimensions.js';
const id = 'clabcdefghijklmnopqrstuvw', path = `${id}/12345678-1234-1234-1234-123456789abc.jpg`;
const manifest = { width: 1600, height: 900, sourceHash: 'a'.repeat(64) };
function fixture() {
  const versions = new Set<string>();
  const db = { vehicle: { findUnique: vi.fn().mockResolvedValue({ photos: [path] }), findFirst: vi.fn().mockResolvedValue({ id }) }, vehiclePhotoDimensions: {
    findMany: vi.fn(async () => [...versions].map(version => ({ version }))),
    createMany: vi.fn(async ({ data }) => { versions.add(data[0].version); return { count: 1 }; }),
  } } as any;
  return { db, versions };
}
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue(new Map([[path, manifest]])); });
describe('legacy dimensions before publication', () => {
  it('prepares owned private photos idempotently without changing approval or rereading sidecars', async () => {
    const { db, versions } = fixture();
    await preparePhotoDimensions(db, id, [path, path]);
    expect(versions.has(photoDimensionVersion(path))).toBe(true);
    expect(mocks.read).toHaveBeenCalledWith([path]);
    await preparePhotoDimensions(db, id, [path]);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(db.vehiclePhotoDimensions.createMany).toHaveBeenCalledTimes(1);
  });
  it('never reads foreign, unassociated or concurrently removed photos', async () => {
    const { db } = fixture();
    await preparePhotoDimensions(db, id, ['other/private.jpg']);
    expect(mocks.read).not.toHaveBeenCalled();
    db.vehicle.findFirst.mockResolvedValue(null);
    await preparePhotoDimensions(db, id, [path]);
    expect(db.vehiclePhotoDimensions.createMany).not.toHaveBeenCalled();
  });
  it('retries missing metadata on a later save, preserving compatibility during rollout', async () => {
    const { db } = fixture(); mocks.read.mockResolvedValueOnce(new Map());
    await preparePhotoDimensions(db, id, [path]);
    expect(db.vehiclePhotoDimensions.createMany).not.toHaveBeenCalled();
    await preparePhotoDimensions(db, id, [path]);
    expect(db.vehiclePhotoDimensions.createMany).toHaveBeenCalledTimes(1);
    db.vehiclePhotoDimensions.findMany.mockRejectedValue({ code: 'P2021' });
    await expect(preparePhotoDimensions(db, id, [path])).resolves.toBeUndefined();
  });
});
