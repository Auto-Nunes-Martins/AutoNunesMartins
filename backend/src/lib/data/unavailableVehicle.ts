import type { PrismaClient } from '@prisma/client';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';

// Only an existing vehicle with an established public address may identify an unavailable listing.
const select = {
  id: true,
  publicSlug: true,
  brand: true,
  model: true,
  year: true,
  photos: true,
  fuel: true,
  mileage: true,
  publicTransmission: true,
  webPublished: true,
  status: true,
  soldDate: true,
  sale: { select: { id: true } },
} as const;

async function findUnavailable(db: PrismaClient, slug: string) {
  const row = await db.vehicle.findUnique({ where: { publicSlug: slug }, select });
  if (!row || row.publicSlug !== slug) return null;
  if (
    row.webPublished &&
    ['AVAILABLE', 'RESERVED'].includes(row.status) &&
    !row.soldDate &&
    !row.sale
  )
    return null;
  return row;
}

export async function readUnavailableVehicle(db: PrismaClient, slug: string) {
  const row = await findUnavailable(db, slug);
  if (!row) return null;
  return {
    slug,
    brand: row.brand,
    model: row.model,
    year: row.year,
    summary: `${row.brand} ${row.model} de ${row.year}, ${({ GASOLINE: 'gasolina', DIESEL: 'gasóleo', HYBRID: 'híbrido', PLUGIN_HYBRID: 'híbrido plug-in', ELECTRIC: 'elétrico', LPG: 'GPL' } as Record<string, string>)[row.fuel] ?? row.fuel}, com ${new Intl.NumberFormat('pt-PT').format(row.mileage)} km${row.publicTransmission ? ` e caixa ${row.publicTransmission === 'AUTOMATIC' ? 'automática' : 'manual'}` : ''}.`,
    photo: row.photos.some((path) => isApprovedPhotoPath(row.id, path))
      ? `/viaturas/${slug}/indisponivel/foto`
      : null,
  };
}

export async function unavailableVehiclePhotoPath(db: PrismaClient, slug: string) {
  const row = await findUnavailable(db, slug);
  return row?.photos.find((path) => isApprovedPhotoPath(row.id, path)) ?? null;
}
