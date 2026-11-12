import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  campaignDayMs,
  campaignKey,
  appliedCampaign,
  currentCampaign,
  parseCampaigns,
  readCampaigns,
  type CampaignAddition,
  type CampaignInput,
  type SavedCampaign,
} from '../data/campaignPricing.js';
import { publicVehicleWhere } from '../data/publicVehicle.js';
import { emitActivity } from '../data/activity.js';

export class CampaignConflict extends Error {}

function checkRevision(expected: string | null, current: string | null) {
  if (expected !== current) {
    throw new CampaignConflict(
      'As campanhas foram alteradas por outra pessoa. Recarregue antes de guardar.',
    );
  }
}

function checkPublicPrice(
  vehicle: { brand: string; model: string; publicPrice: Prisma.Decimal | null } | undefined,
  price: string,
) {
  if (!vehicle?.publicPrice?.gt(0)) {
    throw new CampaignConflict(
      'Uma das viaturas deixou de estar disponível no site. Reveja a seleção.',
    );
  }
  if (!(Number(price) > 0) || vehicle.publicPrice.lte(price)) {
    throw new CampaignConflict(
      `${vehicle.brand} ${vehicle.model}: o preço promocional tem de ser positivo e inferior ao preço base.`,
    );
  }
  return `${vehicle.brand} ${vehicle.model}`;
}

function newCampaign(
  item: CampaignAddition['item'],
  name: string,
  now: number,
  startsAt = now,
): SavedCampaign {
  const endsAt = startsAt + item.durationDays * campaignDayMs;
  if (endsAt <= now) {
    throw new CampaignConflict(
      `${name}: a duração indicada já terminou. Use Remover para terminar a campanha.`,
    );
  }
  return {
    vehicleId: item.vehicleId,
    price: item.price,
    durationDays: item.durationDays,
    applied: true,
    referencePrice: null,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  };
}

async function updateCampaigns<T>(
  db: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  try {
    return await db.$transaction(fn, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) {
      throw new CampaignConflict(
        'As campanhas foram alteradas em simultâneo. Recarregue antes de guardar.',
      );
    }
    throw error;
  }
}

export async function readCampaignEditor(db: PrismaClient) {
  const [campaigns, vehicles] = await Promise.all([
    readCampaigns(db),
    db.vehicle.findMany({
      where: { ...publicVehicleWhere(), status: 'AVAILABLE', publicPrice: { gt: 0 } },
      select: {
        id: true,
        brand: true,
        model: true,
        year: true,
        licensePlate: true,
        publicPrice: true,
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const now = Date.now();
  return {
    revision: campaigns.revision,
    items: campaigns.items.filter((item) => !appliedCampaign(item) || currentCampaign(item, now)),
    candidates: vehicles.map(({ publicPrice, ...vehicle }) => ({
      ...vehicle,
      price: publicPrice!.toFixed(2),
    })),
  };
}

export async function addCampaign(db: PrismaClient, input: CampaignAddition, actorId: string) {
  return updateCampaigns(db, async (tx) => {
    const setting = await tx.appSetting.findUnique({ where: { key: campaignKey } });
    const existing = parseCampaigns(setting?.value);
    checkRevision(input.revision, existing.revision);
    if (existing.items.some(({ vehicleId }) => vehicleId === input.item.vehicleId)) {
      throw new CampaignConflict('Esta viatura já está registada nas campanhas.');
    }
    if (existing.items.length >= 4) {
      throw new CampaignConflict('O limite de quatro campanhas guardadas foi atingido.');
    }
    const [candidate] = await tx.vehicle.findMany({
      where: { ...publicVehicleWhere(), status: 'AVAILABLE', id: input.item.vehicleId },
      select: { brand: true, model: true, publicPrice: true },
      take: 1,
    });
    const name = checkPublicPrice(candidate, input.item.price);
    const now = Date.now();
    const campaign = newCampaign(input.item, name, now);
    const revision = randomUUID();
    const raw = setting?.value as Prisma.JsonObject | undefined;
    const value = {
      ...raw,
      revision,
      items: [...((raw?.items as Prisma.JsonArray | undefined) ?? []), campaign],
    };
    await tx.appSetting.upsert({
      where: { key: campaignKey },
      create: { key: campaignKey, value },
      update: { value },
    });
    await emitActivity(tx, {
      actorId,
      type: 'VEHICLE_UPDATED',
      entityType: 'vehicle',
      entityId: campaignKey,
      message: 'Viatura adicionada às campanhas do site',
      metadata: { vehicleId: input.item.vehicleId },
    });
    return { revision };
  });
}

export async function saveCampaigns(db: PrismaClient, input: CampaignInput, actorId: string) {
  return updateCampaigns(db, async (tx) => {
    const setting = await tx.appSetting.findUnique({ where: { key: campaignKey } });
    const existing = parseCampaigns(setting?.value);
    checkRevision(input.revision, existing.revision);
    const now = Date.now();
    const vehicles = input.items.length
      ? await tx.vehicle.findMany({
          where: {
            ...publicVehicleWhere(),
            status: 'AVAILABLE',
            id: { in: input.items.map((item) => item.vehicleId) },
          },
          select: { id: true, brand: true, model: true, publicPrice: true },
        })
      : [];
    const items: SavedCampaign[] = [];
    for (const item of input.items) {
      const previous = existing.items.find(({ vehicleId }) => vehicleId === item.vehicleId);
      if (
        previous &&
        !appliedCampaign(previous) &&
        !item.recheck &&
        previous.price === item.price &&
        previous.durationDays === item.durationDays
      ) {
        items.push(previous);
        continue;
      }
      const name = checkPublicPrice(
        vehicles.find(({ id }) => id === item.vehicleId),
        item.price,
      );
      const ongoing = previous && appliedCampaign(previous) && currentCampaign(previous, now);
      const startsAt = ongoing ? Date.parse(previous.startsAt) : now;
      if (ongoing && previous.price === item.price) {
        const endsAt = Date.parse(previous.startsAt) + item.durationDays * campaignDayMs;
        if (endsAt <= now) {
          throw new CampaignConflict(
            `${name}: a duração indicada já terminou. Use Remover para terminar a campanha.`,
          );
        }
        items.push({
          ...previous,
          durationDays: item.durationDays,
          endsAt: new Date(endsAt).toISOString(),
        });
        continue;
      }
      items.push({ ...previous, ...newCampaign(item, name, now, startsAt) });
    }
    const revision = randomUUID();
    // Preserve old metadata without reading, extending or recalculating price history.
    const value = { ...(setting?.value as Prisma.JsonObject | undefined), revision, items };
    await tx.appSetting.upsert({
      where: { key: campaignKey },
      create: { key: campaignKey, value },
      update: { value },
    });
    await emitActivity(tx, {
      actorId,
      type: 'VEHICLE_UPDATED',
      entityType: 'vehicle',
      entityId: campaignKey,
      message: 'Campanhas do site atualizadas',
      metadata: { count: items.length },
    });
    return { revision };
  });
}
