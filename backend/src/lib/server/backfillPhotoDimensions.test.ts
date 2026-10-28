import { describe, it, expect, vi } from 'vitest';
import { backfillPhotoDimensions } from './backfillPhotoDimensions.js';
import { photoDimensionVersion } from '../data/photoDimensions.js';
const id = 'clabcdefghijklmnopqrstuvw';
const paths = Array.from({ length: 6 }, (_, i) => `${id}/12345678-1234-1234-1234-123456789ab${i}.jpg`);
function fixture() {
  const versions = new Set<string>();
  const db = { vehicle: {
    findMany: vi.fn().mockImplementation(({ where }) => Promise.resolve(where.id ? [] : [{ id, photos: paths, publicPhotoPaths: paths }])),
    findFirst: vi.fn().mockResolvedValue({ id }),
  }, vehiclePhotoDimensions: {
    count: vi.fn().mockResolvedValue(versions.size),
    findMany: vi.fn().mockImplementation(() => Promise.resolve([...versions].map(version => ({ version })))),
    createMany: vi.fn().mockImplementation(({ data }) => { const fresh = !versions.has(data[0].version); versions.add(data[0].version); return Promise.resolve({ count: fresh ? 1 : 0 }); }),
  } } as any;
  return { db, versions };
}
const options = { apply: false, limit: 10, batchSize: 2, concurrency: 2 };
const manifest = { width: 1600, height: 900, sourceHash: 'a'.repeat(64) };
describe('bounded dimensions backfill', () => {
  it('defaults to a read-only inspection and caps simultaneous sidecar reads', async () => {
    const { db } = fixture(); let active = 0, peak = 0;
    const read = vi.fn(async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 1)); active--; return manifest; });
    const result = await backfillPhotoDimensions(db, read, options);
    expect(result.available).toBe(6); expect(peak).toBe(2);
    expect(db.vehiclePhotoDimensions.createMany).not.toHaveBeenCalled();
    expect(db.vehicle.findFirst).not.toHaveBeenCalled();
  });
  it('is idempotent, skips existing versions and preserves missing-manifest fallback', async () => {
    const { db, versions } = fixture(); versions.add(photoDimensionVersion(paths[0]!));
    const read = vi.fn(async (path: string) => path === paths[5] ? null : manifest);
    const first = await backfillPhotoDimensions(db, read, { ...options, apply: true });
    expect(first).toMatchObject({ existing: 1, created: 4, missing: 1 });
    read.mockClear();
    const second = await backfillPhotoDimensions(db, read, { ...options, apply: true });
    expect(second).toMatchObject({ existing: 5, created: 0, missing: 1 });
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('does not recreate metadata for a photo removed while its manifest was read', async () => {
    const { db } = fixture(); db.vehicle.findFirst.mockResolvedValue(null);
    const result = await backfillPhotoDimensions(db, async () => manifest, { ...options, apply: true });
    expect(result.removed).toBe(6); expect(db.vehiclePhotoDimensions.createMany).not.toHaveBeenCalled();
  });
  it('rejects unbounded options and refuses apply before the migration', async () => {
    const { db } = fixture(), read = vi.fn();
    await expect(backfillPhotoDimensions(db, read, { ...options, concurrency: 20 })).rejects.toThrow();
    db.vehiclePhotoDimensions.count.mockRejectedValue(new Error('table absent'));
    await expect(backfillPhotoDimensions(db, read, { ...options, apply: true })).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it('reads all current owned photos and ignores stale legacy subsets', async () => {
    const { db } = fixture(), read = vi.fn(async () => manifest);
    db.vehicle.findMany.mockResolvedValueOnce([{ id, photos: paths.slice(0, 2), publicPhotoPaths: [paths[1], paths[2]] }]).mockResolvedValue([]);
    const result = await backfillPhotoDimensions(db, read, options);
    expect(result.photos).toBe(2);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledWith(paths[0]);
    expect(read).toHaveBeenCalledWith(paths[1]);
  });
  it('retains the preceding cursor so a failed batch can be retried', async () => {
    const { db } = fixture();
    db.vehicle.findMany.mockResolvedValue([{ id, photos: paths, publicPhotoPaths: paths }]);
    const result = await backfillPhotoDimensions(db, async () => { throw Error('temporary failure'); }, { ...options, after: 'previous' });
    expect(result).toMatchObject({ failed: 6, nextCursor: 'previous' });
    expect(db.vehicle.findMany).toHaveBeenCalledTimes(1);
  });
  it('includes owned private photos only with explicit opt-in and never updates publication', async () => {
    const { db } = fixture(), read = vi.fn(async () => manifest);
    db.vehicle.findMany.mockResolvedValueOnce([{ id, photos: [paths[0], 'other/foreign.jpg'], publicPhotoPaths: [] }]).mockResolvedValue([]);
    const result = await backfillPhotoDimensions(db, read, { ...options, apply: true, includePrivate: true });
    expect(result).toMatchObject({ photos: 1, created: 1 });
    expect(read).toHaveBeenCalledWith(paths[0]);
    expect(db.vehicle.findFirst.mock.calls[0][0].where).toEqual({ id, photos: { has: paths[0] } });
  });
});
