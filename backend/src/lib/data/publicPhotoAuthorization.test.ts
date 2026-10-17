import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getPublicPhotoPath, getPublicPhotoVersions, publicPhotoVersion, publicVehicleWhere } from './publicVehicle.js';

const id = 'clabcdefghijklmnopqrstuvw';
const a = `${id}/12345678-1234-1234-1234-123456789abc.jpg`;
const b = `${id}/12345678-1234-1234-1234-123456789abd.jpg`;
const row = (photos = [a, b], approved = photos) => ({ id, photos, publicPhotoPaths: approved });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function client() {
  const findFirst = vi.fn();
  return { findFirst, db: { vehicle: { findFirst } } as unknown as PrismaClient };
}

describe('in-flight public photo authorization', () => {
  it('shares one pending permission snapshot across indices and identity checks', async () => {
    const { db, findFirst } = client(), query = deferred<ReturnType<typeof row>>();
    findFirst.mockReturnValue(query.promise);
    const paths = Array.from({ length: 20 }, (_, i) => getPublicPhotoPath(db, 'same-slug', i % 2));
    const versions = getPublicPhotoVersions(db, 'same-slug');
    await Promise.resolve();
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst.mock.calls[0][0].where).toEqual({ ...publicVehicleWhere(), publicSlug: 'same-slug' });
    query.resolve(row());
    expect(await Promise.all(paths)).toEqual(Array.from({ length: 20 }, (_, i) => i % 2 ? b : a));
    expect(await versions).toEqual([publicPhotoVersion(a), publicPhotoVersion(b)]);
  });

  it('queries again after settlement, applying reorder, removal and unpublication immediately', async () => {
    const { db, findFirst } = client();
    findFirst.mockResolvedValue(row());
    expect(await getPublicPhotoPath(db, 'slug', 0)).toBe(a);
    findFirst.mockResolvedValue(row([b, a]));
    expect(await getPublicPhotoPath(db, 'slug', 0)).toBe(b);
    findFirst.mockResolvedValue(row([b, a], [a]));
    expect(await getPublicPhotoVersions(db, 'slug')).toEqual([publicPhotoVersion(a)]);
    expect(await getPublicPhotoPath(db, 'slug', 1)).toBeNull();
    findFirst.mockResolvedValue(null);
    expect(await getPublicPhotoPath(db, 'slug', 0)).toBeNull();
    expect(await getPublicPhotoVersions(db, 'slug')).toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(6);
  });

  it('does not retain a denied snapshot or a failed query', async () => {
    const { db, findFirst } = client(), failed = deferred<never>();
    findFirst.mockReturnValue(failed.promise);
    const results = Promise.allSettled([getPublicPhotoPath(db, 'slug', 0), getPublicPhotoVersions(db, 'slug')]);
    await Promise.resolve();
    expect(findFirst).toHaveBeenCalledTimes(1);
    failed.reject(new Error('unavailable'));
    expect((await results).every(r => r.status === 'rejected')).toBe(true);
    findFirst.mockResolvedValue(null);
    expect(await getPublicPhotoPath(db, 'slug', 0)).toBeNull();
    findFirst.mockResolvedValue(row());
    expect(await getPublicPhotoPath(db, 'slug', 0)).toBe(a);
    expect(findFirst).toHaveBeenCalledTimes(3);
  });

  it('cleans up synchronous client failures as well', async () => {
    const { db, findFirst } = client();
    findFirst.mockImplementationOnce(() => { throw new Error('sync failure'); });
    await expect(getPublicPhotoPath(db, 'slug', 0)).rejects.toThrow('sync failure');
    findFirst.mockResolvedValue(row());
    expect(await getPublicPhotoPath(db, 'slug', 0)).toBe(a);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('isolates different slugs and database clients while their queries overlap', async () => {
    const one = client(), two = client(), query = deferred<ReturnType<typeof row>>();
    one.findFirst.mockReturnValue(query.promise); two.findFirst.mockReturnValue(query.promise);
    const reads = [getPublicPhotoPath(one.db, 'first', 0), getPublicPhotoPath(one.db, 'second', 0), getPublicPhotoPath(two.db, 'first', 0)];
    await Promise.resolve();
    expect(one.findFirst).toHaveBeenCalledTimes(2); expect(two.findFirst).toHaveBeenCalledTimes(1);
    query.resolve(row()); await Promise.all(reads);
  });
});
