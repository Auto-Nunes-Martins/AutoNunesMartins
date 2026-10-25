import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';

type Db = Pick<PrismaClient, 'vehiclePhotoDimensions'>;
export type PhotoDimensions = { version: string; width: number; height: number };
type ManifestDimensions = { width: number; height: number; sourceHash: string };
export const photoDimensionVersion = (path: string) => createHash('sha256').update(path).digest('hex');
export function validDimensions(value: { width: number; height: number }) {
  return Number.isSafeInteger(value.width) && Number.isSafeInteger(value.height) &&
    value.width > 0 && value.height > 0 && value.width * value.height <= 24_000_000;
}
export const dimensionsTableMissing = (error: unknown) =>
  (error as { code?: string })?.code === 'P2021';

/** Immutable upload identity: retries do not overwrite metadata for an existing version. */
export async function persistPhotoDimensions(db: Db, vehicleId: string, path: string, manifest: ManifestDimensions) {
  if (!isApprovedPhotoPath(vehicleId, path) || !validDimensions(manifest) ||
      !/^[a-f0-9]{64}$/.test(manifest.sourceHash)) throw new Error('Invalid photo dimensions');
  // Allows old deployments/test adapters to keep serving during an additive rollout.
  if (!db.vehiclePhotoDimensions) return false;
  try {
    const result = await db.vehiclePhotoDimensions.createMany({ data: [{
      version: photoDimensionVersion(path), vehicleId, width: manifest.width,
      height: manifest.height, sourceHash: manifest.sourceHash,
    }], skipDuplicates: true });
    return result.count > 0;
  } catch (error) {
    if (dimensionsTableMissing(error)) return false;
    throw error;
  }
}

/** Called only after references/approval have been revoked. No storage access. */
export async function removePhotoDimensions(db: Db, paths: string[]) {
  if (!paths.length || !db.vehiclePhotoDimensions) return;
  try { await db.vehiclePhotoDimensions.deleteMany({ where: { version: { in: paths.map(photoDimensionVersion) } } }); }
  catch (error) { if (!dimensionsTableMissing(error)) throw error; }
}

/** One indexed DB batch for approved public cover URLs; no manifests/storage on render. */
export async function withCoverPhotoDimensions<T extends { photos: string[] }>(db: Db, vehicles: T[]): Promise<(T & { coverPhotoDimensions?: PhotoDimensions })[]> {
  const versionOf = (vehicle: T) => vehicle.photos[0]?.match(/\?v=([a-f0-9]{64})$/)?.[1];
  const versions = [...new Set(vehicles.map(versionOf).filter((v): v is string => !!v))];
  if (!versions.length || !db.vehiclePhotoDimensions) return vehicles;
  let rows;
  try {
    rows = await db.vehiclePhotoDimensions.findMany({
      where: { version: { in: versions } }, select: { version: true, width: true, height: true },
    });
  } catch {
    // This optional enrichment must not turn an otherwise authorized catalogue into a 503.
    // The primary catalogue query still enforces live permissions independently.
    return vehicles;
  }
  const dimensions = new Map(rows.filter(validDimensions).map(row => [row.version, row]));
  return vehicles.map(vehicle => {
    const version = versionOf(vehicle), value = version && dimensions.get(version);
    return value ? { ...vehicle, coverPhotoDimensions: { version: value.version, width: value.width, height: value.height } } : vehicle;
  });
}
