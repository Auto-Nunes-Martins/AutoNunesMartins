import type { PrismaClient } from '@prisma/client';
import { publicVehicleWhere, approvedPaths } from '../data/publicVehicle.js';
import { dimensionsTableMissing, persistPhotoDimensions, photoDimensionVersion } from '../data/photoDimensions.js';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';

type Options = { apply: boolean; limit: number; batchSize: number; concurrency: number; after?: string; includePrivate?: boolean };
type Manifest = { width: number; height: number; sourceHash: string };
type Db = Pick<PrismaClient, 'vehicle' | 'vehiclePhotoDimensions'>;

/** Bounded sidecar reads only. Never downloads originals or generates/replaces derivatives. */
export async function backfillPhotoDimensions(db: Db, readManifest: (path: string) => Promise<Manifest | null>, options: Options) {
  const { apply, limit, batchSize, concurrency } = options;
  const scope = options.includePrivate ? {} : publicVehicleWhere();
  if (![limit, batchSize, concurrency].every(Number.isSafeInteger) || limit < 1 || limit > 1000 ||
      batchSize < 1 || batchSize > 50 || concurrency < 1 || concurrency > 4) throw Error('Invalid backfill limits');
  // Fail before storage reads when --apply was requested before the migration.
  if (apply) await db.vehiclePhotoDimensions.count();
  const report = { mode: apply ? 'apply' : 'dry-run', vehicles: 0, photos: 0, existing: 0, available: 0, created: 0, missing: 0, removed: 0, failed: 0, nextCursor: options.after ?? null as string | null };
  while (report.vehicles < limit) {
    const rows = await db.vehicle.findMany({
      where: { ...scope, ...(report.nextCursor ? { id: { gt: report.nextCursor } } : {}) },
      select: { id: true, photos: true, publicPhotoPaths: true }, orderBy: { id: 'asc' }, take: Math.min(batchSize, limit - report.vehicles),
    });
    if (!rows.length) break;
    const photos = rows.flatMap(row => (options.includePrivate ? [...new Set(row.photos)].filter(path => isApprovedPhotoPath(row.id, path)) : approvedPaths(row)).map(path => ({ vehicleId: row.id, path, version: photoDimensionVersion(path) })));
    let existing: { version: string }[] = [];
    try { existing = await db.vehiclePhotoDimensions.findMany({ where: { version: { in: photos.map(p => p.version) } }, select: { version: true } }); }
    catch (error) { if (apply || !dimensionsTableMissing(error)) throw error; }
    const known = new Set(existing.map(row => row.version));
    let next = 0;
    const failuresBeforeBatch = report.failed;
    await Promise.all(Array.from({ length: Math.min(concurrency, photos.length) }, async () => {
      while (next < photos.length) {
        const photo = photos[next++]!;
        report.photos++;
        if (known.has(photo.version)) { report.existing++; continue; }
        try {
          const manifest = await readManifest(photo.path);
          if (!manifest) { report.missing++; continue; }
          report.available++;
          if (apply) {
            const current = await db.vehicle.findFirst({ where: { ...scope, id: photo.vehicleId, photos: { has: photo.path }, ...(!options.includePrivate ? { publicPhotoPaths: { has: photo.path } } : {}) }, select: { id: true } });
            if (!current) { report.removed++; continue; }
            if (await persistPhotoDimensions(db, photo.vehicleId, photo.path, manifest)) report.created++;
          }
        } catch { report.failed++; }
      }
    }));
    report.vehicles += rows.length;
    // Retry this batch from the previous cursor if a sidecar/DB operation failed.
    if (report.failed > failuresBeforeBatch) break;
    report.nextCursor = rows.at(-1)!.id;
  }
  return report;
}
