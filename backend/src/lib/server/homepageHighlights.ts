import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { galleryFramingSchema, photoFramingSchema } from '@anm/types';
import {
  publicVehicleDto,
  publicVehicleSelect,
  publicVehicleWhere,
  approvedPaths,
} from '../data/publicVehicle.js';
import { isApprovedPhotoPath } from '../domain/publicVehicle.js';
import { signedPhotos, signedThumbnails } from '../data/storage.js';
import { emitActivity } from '../data/activity.js';
import { eligibleCampaign, readCampaigns } from '../data/campaignPricing.js';

export const highlightsKey = 'homepageHighlights';
export const highlightItemsSchema = z
  .array(
    z
      .object({
        vehicleId: z.string().min(1).max(100),
        photoPath: z.string().min(1).max(500),
        framing: photoFramingSchema.optional(),
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

function coverFraming(value: unknown, path: string) {
  const framing = galleryFramingSchema.safeParse(value).data?.[path];
  // Match public cards: gallery/detail coordinates are a separate destination.
  // Missing or explicitly reset card framing uses the centred default.
  return framing?.card ?? undefined;
}

export async function readHighlightsEditor(db: PrismaClient) {
  const [setting, vehicles] = await Promise.all([
    db.appSetting.findUnique({ where: { key: highlightsKey } }),
    db.vehicle.findMany({
      where: publicVehicleWhere(),
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        photos: true,
        galleryFraming: true,
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const candidates = vehicles.flatMap((vehicle) => {
    const photoPaths = approvedPaths(vehicle);
    const cover = photoPaths[0];
    if (!cover) return [];
    const framing = coverFraming(vehicle.galleryFraming, cover);
    return [
      {
        id: vehicle.id,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        photoPaths,
        ...(framing ? { coverFraming: framing } : {}),
      },
    ];
  });
  const saved = readSetting(setting?.value);
  return {
    ...saved,
    items: saved.items.map(item => {
      const principal = candidates.find(vehicle => vehicle.id === item.vehicleId)?.photoPaths[0];
      return principal && principal !== item.photoPath
        ? { vehicleId: item.vehicleId, photoPath: principal }
        : item;
    }),
    candidates,
  };
}

export async function readHighlightPreviews(db: PrismaClient, requested: string[]) {
  const ids = [...new Set(requested.map((path) => path.split('/')[0]!))];
  const vehicles = await db.vehicle.findMany({
    where: { ...publicVehicleWhere(), id: { in: ids } },
    select: { id: true, photos: true },
  });
  const allowed = new Set(vehicles.flatMap(approvedPaths));
  const paths = [...new Set(requested)].filter((path) => allowed.has(path));
  if (!paths.length) return [];
  const { thumbnails, originals } = await signedThumbnails(paths);
  return paths.map((path) => ({
    path,
    url: thumbnails.get(path) ?? originals.get(path) ?? null,
    originalUrl: originals.get(path) ?? null,
  }));
}

export async function readHighlightGallery(db: PrismaClient, id: string) {
  const vehicle = await db.vehicle.findFirst({
    where: { ...publicVehicleWhere(), id },
    select: { id: true, photos: true, galleryFraming: true },
  });
  const paths = vehicle ? approvedPaths(vehicle) : [];
  if (!paths.length) return null;
  const cover = paths[0]!;
  const framing = coverFraming(vehicle?.galleryFraming, cover);
  return (await signedPhotos(paths)).map((photo) => ({
    ...photo,
    url: photo.url ?? null,
    ...(photo.path === cover && framing ? { coverFraming: framing } : {}),
    galleryFraming: galleryFramingSchema.safeParse(vehicle?.galleryFraming).data?.[photo.path],
  }));
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
            approvedPaths(vehicle)[0] !== item.photoPath ||
            !isApprovedPhotoPath(vehicle.id, item.photoPath)
          ) {
            throw new HighlightsError(
              'A viatura ou a fotografia principal mudou. Recarregue os destaques e reveja o enquadramento.',
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

async function readHighlightSelection(db: PrismaClient, salePrices = false) {
  const setting = await db.appSetting.findUnique({ where: { key: highlightsKey } });
  const { items } = readSetting(setting?.value);
  const vehicles = items.length
    ? await db.vehicle.findMany({
        where: { ...publicVehicleWhere(), id: { in: items.map((item) => item.vehicleId) } },
        select: publicVehicleSelect,
      })
    : [];
  const campaigns = salePrices && vehicles.length ? (await readCampaigns(db)).items : [];
  const now = Date.now();
  return {
    configured: !!setting,
    configuredVehicleIds: items.map((item) => item.vehicleId),
    items: items.flatMap((item) => {
      const row = vehicles.find((vehicle) => vehicle.id === item.vehicleId);
      if (!row) return [];
      const approved = approvedPaths(row);
      const principal = approved[0];
      if (!principal) return [];
      return [
        {
          id: row.id,
          vehicle: publicVehicleDto(row, eligibleCampaign(row, campaigns, now)),
          photoIndex: 0,
          ...(item.photoPath === principal && item.framing ? { framing: item.framing } : {}),
        },
      ];
    }),
  };
}

export async function readPublicHighlights(db: PrismaClient) {
  const selection = await readHighlightSelection(db, true);
  return {
    configured: selection.configured,
    items: selection.items.map(({ vehicle, photoIndex, framing }) => ({
      vehicle,
      photoIndex,
      ...(framing ? { framing } : {}),
    })),
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
