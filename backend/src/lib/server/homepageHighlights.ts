import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  publicVehicleDto,
  publicVehicleSelect,
  publicVehicleWhere,
} from '../data/publicVehicle.js';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';
import { createSignedReadUrls } from '../data/storage.js';
import { emitActivity } from '../data/activity.js';

export const highlightsKey = 'homepageHighlights';
export const highlightItemsSchema = z
  .array(
    z
      .object({
        vehicleId: z.string().min(1).max(100),
        photoPath: z.string().min(1).max(500),
      })
      .strict(),
  )
  .max(5)
  .refine(
    (items) => new Set(items.map((item) => item.vehicleId)).size === items.length,
    'Escolha cada viatura apenas uma vez.',
  );
export const highlightsInputSchema = z
  .object({
    revision: z.string().uuid().nullable(),
    items: highlightItemsSchema,
  })
  .strict();
const storedSchema = highlightsInputSchema.extend({ revision: z.string().uuid() });
export type HighlightItem = z.infer<typeof highlightItemsSchema>[number];
function readSetting(value: unknown) {
  if (value === undefined) return { revision: null, items: [] as HighlightItem[] };
  return storedSchema.parse(value);
}
export class HighlightsError extends Error {
  readonly status = 409;
}

export async function readHighlightsEditor(db: PrismaClient) {
  const [setting, vehicles] = await Promise.all([
    db.appSetting.findUnique({ where: { key: highlightsKey } }),
    db.vehicle.findMany({
      where: publicVehicleWhere(),
      select: publicVehicleSelect,
      orderBy: [{ brand: 'asc' }, { model: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const candidates = vehicles
    .map((vehicle) => ({
      id: vehicle.id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      slug: vehicle.publicSlug!,
      photos: [...new Set(vehicle.publicPhotoPaths)]
        .filter((path) => vehicle.photos.includes(path) && isApprovedPhotoPath(vehicle.id, path))
        .slice(0, 20),
    }))
    .filter((vehicle) => vehicle.photos.length);
  const urls = await createSignedReadUrls(candidates.flatMap((vehicle) => vehicle.photos));
  return {
    ...readSetting(setting?.value),
    candidates: candidates.map((vehicle) => ({
      ...vehicle,
      photos: vehicle.photos.map((path) => ({ path, url: urls.get(path) ?? null })),
    })),
  };
}

export async function saveHighlights(
  db: PrismaClient,
  input: z.infer<typeof highlightsInputSchema>,
  actorId: string | null,
) {
  try {
    return await db.$transaction(
      async (tx) => {
        const existing = await tx.appSetting.findUnique({ where: { key: highlightsKey } });
        if (readSetting(existing?.value).revision !== input.revision) {
          throw new HighlightsError(
            'Outro administrador alterou os destaques. Recarregue antes de guardar.',
          );
        }
        const vehicles = await tx.vehicle.findMany({
          where: { ...publicVehicleWhere(), id: { in: input.items.map((item) => item.vehicleId) } },
          select: publicVehicleSelect,
        });
        for (const item of input.items) {
          const vehicle = vehicles.find((row) => row.id === item.vehicleId);
          if (
            !vehicle ||
            !vehicle.publicPhotoPaths.includes(item.photoPath) ||
            !vehicle.photos.includes(item.photoPath) ||
            !isApprovedPhotoPath(vehicle.id, item.photoPath)
          ) {
            throw new HighlightsError(
              'Uma viatura ou fotografia já não está autorizada no site. Reveja a seleção.',
            );
          }
        }
        const value = { revision: randomUUID(), items: input.items };
        await tx.appSetting.upsert({
          where: { key: highlightsKey },
          create: { key: highlightsKey, value },
          update: { value },
        });
        await emitActivity(tx, {
          actorId,
          type: 'VEHICLE_UPDATED',
          entityType: 'vehicle',
          entityId: highlightsKey,
          message: 'Destaques da homepage atualizados',
          metadata: { count: input.items.length },
        });
        return { revision: value.revision };
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) {
      throw new HighlightsError(
        'Os destaques foram alterados em simultâneo. Recarregue antes de guardar.',
      );
    }
    throw error;
  }
}

async function readHighlightSelection(db: PrismaClient) {
  const setting = await db.appSetting.findUnique({ where: { key: highlightsKey } });
  const { items } = readSetting(setting?.value);
  const vehicles = items.length
    ? await db.vehicle.findMany({
        where: { ...publicVehicleWhere(), id: { in: items.map((item) => item.vehicleId) } },
        select: publicVehicleSelect,
      })
    : [];
  return {
    configured: !!setting,
    items: items.flatMap((item) => {
      const row = vehicles.find((vehicle) => vehicle.id === item.vehicleId);
      if (!row) return [];
      const approved = [...new Set(row.publicPhotoPaths)]
        .filter((path) => row.photos.includes(path) && isApprovedPhotoPath(row.id, path))
        .slice(0, 20);
      const index = approved.indexOf(item.photoPath);
      if (index < 0) return [];
      return [{ id: row.id, vehicle: publicVehicleDto(row), photoIndex: index }];
    }),
  };
}

export async function readPublicHighlights(db: PrismaClient) {
  const selection = await readHighlightSelection(db);
  return {
    ...selection,
    items: selection.items.map(({ vehicle, photoIndex }) => ({ vehicle, photoIndex })),
  };
}

/** Same live selection and photo validation as the public homepage; IDs remain private. */
export async function readDashboardHighlights(db: PrismaClient) {
  const selection = await readHighlightSelection(db);
  const plates = selection.items.length
    ? await db.vehicle.findMany({
        where: { id: { in: selection.items.map((item) => item.id) } },
        select: { id: true, licensePlate: true },
      })
    : [];
  return {
    ...selection,
    items: selection.items.map((item) => ({
      ...item,
      licensePlate: plates.find((vehicle) => vehicle.id === item.id)?.licensePlate ?? null,
    })),
  };
}
