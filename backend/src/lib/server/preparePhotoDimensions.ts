import type { PrismaClient } from '@prisma/client';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';
import { persistPhotoDimensions, photoDimensionVersion } from '../data/photoDimensions.js';
import { readVariantManifests } from './photoVariants.js';
import { logger } from '../../logger.js';

/** Prepare legacy owned photos outside the publication transaction. Never encodes images.
 * Approval is still validated in the transaction; metadata cannot grant public access.
 * Missing legacy manifests/rolling deployments keep the existing fallback and retry on save.
 */
export async function preparePhotoDimensions(db: PrismaClient, vehicleId: string, requested: string[]) {
  if (!requested.length || !db.vehiclePhotoDimensions) return;
  try {
    const vehicle = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { photos: true } });
    const paths = [...new Set(requested)].filter(path => vehicle?.photos.includes(path) && isApprovedPhotoPath(vehicleId, path));
    if (!paths.length) return;
    const existing = await db.vehiclePhotoDimensions.findMany({ where: { version: { in: paths.map(photoDimensionVersion) } }, select: { version: true } });
    const known = new Set(existing.map(row => row.version));
    const missing = paths.filter(path => !known.has(photoDimensionVersion(path)));
    if (!missing.length) return;
    const manifests = await readVariantManifests(missing);
    let pending = 0;
    for (const path of missing) {
      const manifest = manifests.get(path);
      if (!manifest) { pending++; continue; }
      // A concurrent deletion must not restore metadata for a removed photograph.
      const current = await db.vehicle.findFirst({ where: { id: vehicleId, photos: { has: path } }, select: { id: true } });
      if (current) await persistPhotoDimensions(db, vehicleId, path, manifest);
    }
    if (pending) logger.warn({ count: pending }, 'Photo dimensions unavailable; publication retains legacy image fallback');
  } catch {
    logger.warn('Photo dimensions preparation unavailable; retry on the next save');
  }
}
