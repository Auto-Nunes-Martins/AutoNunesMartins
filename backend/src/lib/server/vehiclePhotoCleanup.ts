import { prisma } from '../../db.js';
import { logger } from '../../logger.js';
import { deleteObjects, getBucketName, getSupabase } from '../data/storage.js';
import { variantRoot } from './photoVariants.js';

/** Only exact master paths owned by this vehicle; never list/delete a bucket or prefix. */
export function vehicleCleanupPhotos(vehicleId: string, photos: string[]): string[] {
  if (!/^[a-zA-Z0-9_-]+$/.test(vehicleId)) throw new Error('Invalid vehicle photo owner');
  const unique = [...new Set(photos)];
  for (const path of unique) {
    variantRoot(path);
    if (path.split('/')[0] !== vehicleId) throw new Error('Photo does not belong to vehicle');
  }
  return unique;
}

async function storedPhotoMasters(vehicleId: string): Promise<string[]> {
  vehicleCleanupPhotos(vehicleId, []);
  const bucket = getSupabase().storage.from(getBucketName());
  const photos = new Set<string>();
  // Staged/failed uploads can exist without a reference in Vehicle.photos.
  // Only inspect the exact vehicle namespace and our known v1 derivative namespace.
  for (const directory of [vehicleId, `${vehicleId}/.variants/v1`]) {
    for (let offset = 0; ; offset += 250) {
      const { data, error } = await bucket.list(directory, {
        limit: 250,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error || !data) throw new Error('Vehicle photo inventory unavailable');
      for (const item of data) {
        if (/^[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(item.name))
          photos.add(`${vehicleId}/${item.name}`);
      }
      if (photos.size > 5000 || offset >= 10000)
        throw new Error('Vehicle photo inventory exceeds cleanup batch');
      if (data.length < 250) break;
    }
  }
  return [...photos];
}

const running = new Map<string, Promise<void>>();
export function cleanupVehiclePhotos(vehicleId: string): Promise<void> {
  const pending = running.get(vehicleId);
  if (pending) return pending;
  const work = clean(vehicleId).finally(() => running.delete(vehicleId));
  running.set(vehicleId, work);
  return work;
}

async function clean(vehicleId: string): Promise<void> {
  try {
    const job = await prisma.vehiclePhotoCleanup.findUnique({ where: { vehicleId } });
    if (!job) return;
    try {
      // A restored/recreated record must never lose its live files to an older job.
      if (await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } }))
        throw new Error('Vehicle exists; photo cleanup deferred');
      const photos = vehicleCleanupPhotos(vehicleId, [
        ...job.photos,
        ...(await storedPhotoMasters(vehicleId)),
      ]);
      // Bound each Storage request, including generated variants and the sidecar.
      for (let i = 0; i < photos.length; i += 50) await deleteObjects(photos.slice(i, i + 50));
      await prisma.vehiclePhotoCleanup.deleteMany({ where: { vehicleId } });
    } catch {
      // Keep the complete inventory on partial failures. Exact-object removal is idempotent.
      await prisma.vehiclePhotoCleanup.updateMany({
        where: { vehicleId },
        data: {
          attempts: { increment: 1 },
          nextAttemptAt: new Date(
            Date.now() + Math.min(3_600_000, 30_000 * 2 ** Math.min(job.attempts, 7)),
          ),
        },
      });
      logger.error('Vehicle photo cleanup pending; automatic retry scheduled');
    }
  } catch {
    // A database outage must not erase the persisted inventory or fail a committed deletion.
    logger.error('Vehicle photo cleanup unavailable; persisted jobs will be retried');
  }
}

export function startVehiclePhotoCleanup(): () => Promise<void> {
  let stopped = false;
  let sweep: Promise<void> | undefined;
  const tick = () => {
    if (stopped || sweep) return;
    sweep = (async () => {
      try {
        const jobs = await prisma.vehiclePhotoCleanup.findMany({
          where: { nextAttemptAt: { lte: new Date() } },
          orderBy: { nextAttemptAt: 'asc' },
          take: 5,
          select: { vehicleId: true },
        });
        for (const job of jobs) {
          if (stopped) break;
          await cleanupVehiclePhotos(job.vehicleId);
        }
      } catch {
        logger.error('Vehicle photo cleanup queue unavailable; retrying later');
      }
    })().finally(() => {
      sweep = undefined;
    });
  };
  const timer = setInterval(tick, 30_000);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await sweep;
    await Promise.allSettled([...running.values()]);
  };
}
