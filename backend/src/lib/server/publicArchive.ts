import type { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { orderedPublicPhotos } from '../../../../shared/vehiclePhotoPrincipal.mjs';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';
import { readPhotoBytes } from './photoVariants.js';

type DB = PrismaClient | Prisma.TransactionClient;
export const archiveOrigin = (id: string) => createHash('sha256').update(id).digest('hex');
export class ArchiveSlugConflict extends Error {}
export type PreparedArchivePhoto = { path: string; bytes: Buffer };
export type ArchiveSource = {
  id: string;
  brand: string;
  model: string;
  year: number;
  slug: string;
  photos: string[];
  approved: string[];
};

/** Private publisher only. Preparation is outside the write transaction; ownership/approval is checked again at commit. */
export async function prepareArchivePhoto(
  id: string,
  photos: string[],
  approved: string[],
  policy?: { identificationAllowed: boolean; photoAllowed: boolean } | null,
): Promise<PreparedArchivePhoto | undefined> {
  if (policy && (!policy.identificationAllowed || !policy.photoAllowed)) return;
  const path = orderedPublicPhotos(photos, approved).find((path) => isApprovedPhotoPath(id, path));
  if (!path) return;
  const source = await readPhotoBytes(path, 800);
  if (!source) throw new Error('Approved archive photo unavailable');
  for (const [width, quality] of [
    [800, 88],
    [640, 84],
    [320, 82],
  ] as const) {
    const bytes = await sharp(source.buffer, { limitInputPixels: 24_000_000, failOn: 'warning' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .timeout({ seconds: 5 })
      .toBuffer();
    if (bytes.length <= 800_000) return { path, bytes };
  }
  throw new Error('Archive derivative exceeds supported size');
}

export async function prepareVehicleArchive(
  db: DB,
  id: string,
  input: { published: boolean; photoPaths?: string[] },
  photos?: string[],
) {
  if (!input.published) return;
  const current = await db.vehicle.findUnique({
    where: { id },
    select: { publicSlug: true, photos: true },
  });
  if (!current) return;
  const policy = current.publicSlug
    ? await db.publicVehicleArchive.findUnique({
        where: { slug: current.publicSlug },
        select: { identificationAllowed: true, photoAllowed: true },
      })
    : null;
  return prepareArchivePhoto(id, photos ?? current.photos, input.photoPaths ?? [], policy);
}

/** Call only after successful publication validation, inside that same transaction. */
export async function syncPublishedArchive(
  tx: DB,
  source: ArchiveSource,
  prepared?: PreparedArchivePhoto,
  explicitAuthorization = false,
) {
  // Serialize with owner withdrawals. A publisher must observe a withdrawal that won this lock.
  await tx.$queryRaw`SELECT "slug" FROM "PublicVehicleArchive" WHERE "slug" = ${source.slug} FOR UPDATE`;
  const existing = await tx.publicVehicleArchive.findUnique({ where: { slug: source.slug } });
  if (existing && existing.originKey !== archiveOrigin(source.id))
    throw new ArchiveSlugConflict('Historical address belongs to another vehicle');
  const approved = orderedPublicPhotos(source.photos, source.approved).filter((path) =>
    isApprovedPhotoPath(source.id, path),
  );
  if (prepared && (!approved.includes(prepared.path) || prepared.bytes.length > 800_000))
    throw new Error('Archive photo approval changed');
  const removed = !!existing?.photoSourcePath && !approved.includes(existing.photoSourcePath);
  const identificationAllowed = explicitAuthorization || existing?.identificationAllowed !== false;
  const photoAllowed = explicitAuthorization || (existing?.photoAllowed !== false && !removed);
  const photo = identificationAllowed && photoAllowed ? prepared : undefined;
  const revoke = !identificationAllowed || !photoAllowed;
  const data = {
    originKey: archiveOrigin(source.id),
    vehicleId: source.id,
    brand: source.brand,
    model: source.model,
    year: source.year,
    identificationAllowed,
    photoAllowed,
    ...(photo
      ? { photoSourcePath: photo.path, photoBytes: photo.bytes }
      : revoke
        ? { photoSourcePath: null, photoBytes: null }
        : {}),
  };
  await tx.publicVehicleArchive.upsert({
    where: { slug: source.slug },
    create: { slug: source.slug, ...data },
    update: data,
  });
}

/** Same transaction as explicit photo removal/approval withdrawal; sticky until explicit owner reauthorization. */
export async function revokeArchivePhotos(
  tx: DB,
  id: string,
  photos: string[],
  approved: string[],
) {
  const keep = orderedPublicPhotos(photos, approved);
  await tx.publicVehicleArchive.updateMany({
    where: { vehicleId: id, photoSourcePath: { not: null, notIn: keep } },
    data: { photoAllowed: false, photoSourcePath: null, photoBytes: null },
  });
}

const relation = {
  select: {
    webPublished: true,
    status: true,
    soldDate: true,
    sale: { select: { id: true } },
    photos: true,
    publicPhotoPaths: true,
  },
} as const;
const publicSelect = {
  slug: true,
  brand: true,
  model: true,
  year: true,
  identificationAllowed: true,
  photoAllowed: true,
  photoSourcePath: true,
  vehicle: relation,
} as const;
type ArchiveView = Prisma.PublicVehicleArchiveGetPayload<{ select: typeof publicSelect }>;
function visible(row: ArchiveView | null) {
  if (!row?.identificationAllowed) return false;
  const v = row.vehicle;
  return (
    !v ||
    !v.webPublished ||
    !['AVAILABLE', 'RESERVED'].includes(v.status) ||
    !!v.soldDate ||
    !!v.sale
  );
}
function photoAuthorized(row: ArchiveView) {
  return (
    row.photoAllowed &&
    !!row.photoSourcePath &&
    (!row.vehicle ||
      (row.vehicle.photos.includes(row.photoSourcePath) &&
        row.vehicle.publicPhotoPaths.includes(row.photoSourcePath)))
  );
}
export async function readPublicArchive(db: DB, slug: string) {
  const row = await db.publicVehicleArchive.findUnique({ where: { slug }, select: publicSelect });
  return visible(row) && row
    ? {
        slug: row.slug,
        brand: row.brand,
        model: row.model,
        year: row.year,
        photo: photoAuthorized(row) ? `/viaturas/${slug}/arquivo/foto` : null,
      }
    : null;
}
export async function readPublicArchivePhoto(db: DB, slug: string) {
  const row = await db.publicVehicleArchive.findUnique({
    where: { slug },
    select: { ...publicSelect, photoBytes: true },
  });
  return visible(row) &&
    row &&
    photoAuthorized(row) &&
    row.photoBytes?.length &&
    row.photoBytes.length <= 800_000
    ? Buffer.from(row.photoBytes)
    : null;
}
