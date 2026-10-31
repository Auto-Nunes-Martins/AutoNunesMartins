import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    vehicle: { findUnique: vi.fn(), delete: vi.fn() },
    vehiclePhotoCleanup: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    activityLog: { create: vi.fn() },
  },
  remove: vi.fn(),
  list: vi.fn(),
  error: vi.fn(),
}));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
vi.mock('../../logger.js', () => ({ logger: { error: mocks.error } }));
vi.mock('../../env.js', () => ({
  getEnv: () => ({ SUPABASE_URL: 'https://fixture.invalid', SUPABASE_STORAGE_BUCKET: 'photos' }),
  getSupabaseServerKey: () => 'fixture',
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ storage: { from: () => ({ remove: mocks.remove, list: mocks.list }) } }),
}));
import { deleteVehicle, VehicleHasSale, VehicleNotFound } from './vehicleService.js';
import { cleanupVehiclePhotos, startVehiclePhotoCleanup } from './vehiclePhotoCleanup.js';
import { PHOTO_WIDTHS, manifestPath, variantPath } from './photoVariants.js';

const actor = { actorId: 'admin', actorName: 'Admin' };
const photo = 'vehicle/photo.jpg';
const legacyPhoto = 'vehicle/legacy.webp';
const paths = (p: string) => [p, ...PHOTO_WIDTHS.map((w) => variantPath(p, w)), manifestPath(p)];
let vehicle: any;
let jobs: Map<string, any>;
let objects: Set<string>;
let activity: any[];
let inTransaction = false;
let rejectCommit = false;

beforeEach(() => {
  vi.clearAllMocks();
  vehicle = {
    id: 'vehicle',
    brand: 'BMW',
    model: 'One',
    year: 2020,
    photos: [photo],
    publicPhotoPaths: [photo, legacyPhoto],
    sale: null,
  };
  jobs = new Map();
  objects = new Set([...paths(photo), ...paths(legacyPhoto), ...paths('other/keep.jpg')]);
  activity = [{ type: 'VEHICLE_ADDED' }, { type: 'VEHICLE_STATUS_CHANGED' }];
  inTransaction = false;
  rejectCommit = false;
  mocks.db.$transaction.mockImplementation(async (work) => {
    const before = { vehicle, jobs: new Map(jobs), activity: [...activity] };
    inTransaction = true;
    try {
      const result = await work(mocks.db);
      if (rejectCommit) throw new Error('Commit failed');
      return result;
    } catch (e) {
      vehicle = before.vehicle;
      jobs = before.jobs;
      activity = before.activity;
      throw e;
    } finally {
      inTransaction = false;
    }
  });
  mocks.db.$queryRaw.mockResolvedValue([]);
  mocks.db.vehicle.findUnique.mockImplementation(async () => vehicle);
  mocks.db.vehicle.delete.mockImplementation(async () => {
    vehicle = null;
  });
  mocks.db.activityLog.create.mockImplementation(async ({ data }) => {
    activity.push(data);
  });
  mocks.db.vehiclePhotoCleanup.create.mockImplementation(async ({ data }) => {
    jobs.set(data.vehicleId, { ...data, attempts: 0, nextAttemptAt: new Date() });
  });
  mocks.db.vehiclePhotoCleanup.findUnique.mockImplementation(
    async ({ where }) => jobs.get(where.vehicleId) ?? null,
  );
  mocks.db.vehiclePhotoCleanup.findMany.mockImplementation(async () =>
    [...jobs.values()].filter((j) => j.nextAttemptAt <= new Date()).slice(0, 5),
  );
  mocks.db.vehiclePhotoCleanup.deleteMany.mockImplementation(async ({ where }) => {
    jobs.delete(where.vehicleId);
  });
  mocks.db.vehiclePhotoCleanup.updateMany.mockImplementation(async ({ where, data }) => {
    const row = jobs.get(where.vehicleId);
    if (row) {
      row.attempts++;
      row.nextAttemptAt = data.nextAttemptAt;
    }
  });
  mocks.remove.mockImplementation(async (keys: string[]) => {
    expect(inTransaction).toBe(false);
    for (const key of keys) objects.delete(key);
    return { error: null };
  });
  mocks.list.mockImplementation(
    async (directory: string, { offset, limit }: { offset: number; limit: number }) => {
      expect(directory === 'vehicle' || directory === 'vehicle/.variants/v1').toBe(true);
      const names = [
        ...new Set(
          [...objects]
            .filter((p) => p.startsWith(directory + '/'))
            .map((p) => p.slice(directory.length + 1).split('/')[0]),
        ),
      ].sort();
      return { data: names.slice(offset, offset + limit).map((name) => ({ name })), error: null };
    },
  );
});

it('commits deletion before removing exactly its masters, all widths and sidecars; preserves activity', async () => {
  await deleteVehicle('vehicle', actor);
  expect(vehicle).toBeNull();
  expect(jobs.size).toBe(0);
  expect(objects).toEqual(new Set(paths('other/keep.jpg')));
  expect(mocks.remove).toHaveBeenCalledTimes(1);
  expect(activity.map((a) => a.type)).toEqual([
    'VEHICLE_ADDED',
    'VEHICLE_STATUS_CHANGED',
    'VEHICLE_DELETED',
  ]);
});

it('keeps a durable retry inventory on Storage failure and completes it after a worker restart', async () => {
  mocks.remove.mockResolvedValueOnce({ error: new Error('Storage unavailable') });
  await deleteVehicle('vehicle', actor);
  expect(vehicle).toBeNull();
  expect(jobs.get('vehicle').photos).toEqual([photo, legacyPhoto]);
  expect(jobs.get('vehicle').attempts).toBe(1);
  expect(jobs.get('vehicle').nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  jobs.get('vehicle').nextAttemptAt = new Date(0);
  const stop = startVehiclePhotoCleanup();
  try {
    await vi.waitFor(() => expect(jobs.size).toBe(0));
  } finally {
    await stop();
  }
  expect(objects).toEqual(new Set(paths('other/keep.jpg')));
  expect(activity).toHaveLength(3);
});

it('does not touch Storage or keep a cleanup job when the database transaction rolls back', async () => {
  rejectCommit = true;
  await expect(deleteVehicle('vehicle', actor)).rejects.toThrow('Commit failed');
  expect(vehicle.id).toBe('vehicle');
  expect(jobs.size).toBe(0);
  expect(activity).toHaveLength(2);
  expect(mocks.remove).not.toHaveBeenCalled();
});

it('does not delete live photos if a record is restored while a cleanup retry is pending', async () => {
  const restored = vehicle;
  mocks.remove.mockResolvedValueOnce({ error: new Error('Storage unavailable') });
  await deleteVehicle('vehicle', actor);
  vehicle = restored;
  mocks.remove.mockClear();
  await cleanupVehiclePhotos('vehicle');
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(jobs.size).toBe(1);
  expect(objects.has(photo)).toBe(true);
});

it('blocks active sales, other foreign-key restrictions, missing vehicles and foreign photo paths', async () => {
  vehicle.sale = { id: 'sale' };
  await expect(deleteVehicle('vehicle', actor)).rejects.toBeInstanceOf(VehicleHasSale);
  vehicle.sale = null;
  mocks.db.vehicle.delete.mockRejectedValueOnce(
    Object.assign(new Error('Sale history'), { code: 'P2003' }),
  );
  await expect(deleteVehicle('vehicle', actor)).rejects.toHaveProperty('code', 'P2003');
  vehicle.photos = ['other/keep.jpg'];
  await expect(deleteVehicle('vehicle', actor)).rejects.toThrow('Photo does not belong');
  vehicle = null;
  await expect(deleteVehicle('vehicle', actor)).rejects.toBeInstanceOf(VehicleNotFound);
  expect(jobs.size).toBe(0);
  expect(mocks.remove).not.toHaveBeenCalled();
});

it('retries partially removed batches idempotently without widening the object scope', async () => {
  vehicle.photos = Array.from({ length: 51 }, (_, i) => `vehicle/photo-${i}.jpg`);
  vehicle.publicPhotoPaths = [];
  objects = new Set([...vehicle.photos.flatMap(paths), ...paths('other/keep.jpg')]);
  mocks.remove.mockImplementationOnce(async (keys) => {
    for (const key of keys) objects.delete(key);
    return { error: null };
  });
  mocks.remove.mockResolvedValueOnce({ error: new Error('Second batch failed') });
  await deleteVehicle('vehicle', actor);
  expect(jobs.get('vehicle').photos).toHaveLength(51);
  await cleanupVehiclePhotos('vehicle');
  expect(jobs.size).toBe(0);
  expect(objects).toEqual(new Set(paths('other/keep.jpg')));
});

it('also discovers unreferenced objects when the vehicle has no committed photos', async () => {
  vehicle.photos = [];
  vehicle.publicPhotoPaths = [];
  await deleteVehicle('vehicle', actor);
  expect(mocks.db.vehiclePhotoCleanup.create).toHaveBeenCalled();
  expect(objects).toEqual(new Set(paths('other/keep.jpg')));
  expect(activity.at(-1).type).toBe('VEHICLE_DELETED');
});

it('discovers staged masters and orphan derivatives only inside the deleted vehicle namespace', async () => {
  for (const key of paths('vehicle/staged.png')) objects.add(key);
  for (const key of paths('vehicle/orphan.jpg').slice(1)) objects.add(key);
  objects.add('vehicle/private-document.pdf');
  await deleteVehicle('vehicle', actor);
  expect(objects).toEqual(new Set([...paths('other/keep.jpg'), 'vehicle/private-document.pdf']));
});

it('retains the job if listing fails and paginates inventories before deleting objects', async () => {
  mocks.list.mockResolvedValueOnce({ data: null, error: new Error('Unavailable') });
  await deleteVehicle('vehicle', actor);
  expect(jobs.size).toBe(1);
  expect(mocks.remove).not.toHaveBeenCalled();
  for (let i = 0; i < 251; i++) objects.add(`vehicle/staged-${i}.jpg`);
  await cleanupVehiclePhotos('vehicle');
  expect(objects).toEqual(new Set(paths('other/keep.jpg')));
  expect(
    mocks.list.mock.calls.some(
      ([directory, options]) => directory === 'vehicle' && options.offset === 250,
    ),
  ).toBe(true);
});
