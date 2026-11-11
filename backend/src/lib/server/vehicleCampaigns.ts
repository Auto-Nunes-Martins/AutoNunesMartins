import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  campaignDayMs,
  campaignKey,
  currentCampaign,
  readCampaigns,
  type CampaignInput,
  type SavedCampaign,
} from '../data/campaignPricing.js';
import { publicVehicleWhere } from '../data/publicVehicle.js';
import { emitActivity } from '../data/activity.js';

export class CampaignConflict extends Error {}

async function readPriceHistory(db: Pick<Prisma.TransactionClient, 'activityLog'>, ids: string[]) {
  if (!ids.length) return [];
  return db.activityLog.findMany({
    where: {
      entityType: 'vehicle',
      entityId: { in: ids },
      metadata: { path: ['publicPriceHistory'], not: Prisma.AnyNull },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { entityId: true, createdAt: true, metadata: true },
  });
}

function lowestReference(
  id: string,
  base: Prisma.Decimal,
  history: Awaited<ReturnType<typeof readPriceHistory>>,
  campaigns: Awaited<ReturnType<typeof readCampaigns>>,
  now: number,
) {
  const cutoff = now - 30 * campaignDayMs;
  let lowest = base;
  for (const record of history) {
    if (record.entityId !== id) continue;
    const metadata = record.metadata as { publicPriceHistory?: string | number } | null;
    const value = metadata?.publicPriceHistory;
    if (value !== 'unpriced') {
      if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) return null;
      const price = new Prisma.Decimal(value);
      if (price.lt(lowest)) lowest = price;
    }
    if (record.createdAt.getTime() <= cutoff) {
      for (const offer of [...campaigns.items, ...campaigns.recent]) {
        const endsAt = 'endsAt' in offer ? offer.endsAt : offer.endedAt;
        if (
          offer.vehicleId === id &&
          Date.parse(endsAt) > cutoff &&
          (!('referencePrice' in offer) || offer.referencePrice !== null) &&
          lowest.gt(offer.price)
        ) {
          lowest = new Prisma.Decimal(offer.price);
        }
      }
      return lowest.toFixed(2);
    }
  }
  return null;
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
  const history = await readPriceHistory(
    db,
    vehicles.map(({ id }) => id),
  );
  return {
    revision: campaigns.revision,
    items: campaigns.items.filter(
      (item) => item.referencePrice === null || currentCampaign(item, now),
    ),
    candidates: vehicles.map(({ publicPrice, ...vehicle }) => ({
      ...vehicle,
      price: publicPrice!.toFixed(2),
      referencePrice: lowestReference(vehicle.id, publicPrice!, history, campaigns, now),
    })),
  };
}

export async function saveCampaigns(db: PrismaClient, input: CampaignInput, actorId: string) {
  try {
    return await db.$transaction(
      async (tx) => {
        const existing = await readCampaigns(tx);
        if (existing.revision !== input.revision) {
          throw new CampaignConflict(
            'As campanhas foram alteradas por outra pessoa. Recarregue antes de guardar.',
          );
        }
        const now = Date.now();
        const startsAt = new Date(now).toISOString();
        const cutoff = now - 30 * campaignDayMs;
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
        const recent = existing.recent.filter(({ endedAt }) => Date.parse(endedAt) > cutoff);
        const history = await readPriceHistory(
          tx,
          vehicles.map(({ id }) => id),
        );
        const items: SavedCampaign[] = [];
        for (const item of input.items) {
          const vehicle = vehicles.find(({ id }) => id === item.vehicleId);
          if (!vehicle?.publicPrice?.gt(0)) {
            throw new CampaignConflict(
              'Uma das viaturas deixou de estar disponível no site. Reveja a seleção.',
            );
          }
          const name = `${vehicle.brand} ${vehicle.model}`;
          if (vehicle.publicPrice.lte(item.price)) {
            throw new CampaignConflict(
              `${name}: o preço promocional tem de ser inferior ao preço público normal.`,
            );
          }
          const previous = existing.items.find(({ vehicleId }) => vehicleId === item.vehicleId);
          if (
            previous?.referencePrice === null &&
            !item.recheck &&
            previous.price === item.price &&
            previous.durationDays === item.durationDays
          ) {
            items.push(previous);
            continue;
          }
          if (
            previous &&
            previous.referencePrice !== null &&
            currentCampaign(previous, now) &&
            previous.price === item.price &&
            vehicle.publicPrice.gte(previous.referencePrice)
          ) {
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
          const referencePrice = lowestReference(
            item.vehicleId,
            vehicle.publicPrice,
            history,
            existing,
            now,
          );
          if (referencePrice !== null && Number(item.price) >= Number(referencePrice)) {
            throw new CampaignConflict(
              `${name}: o preço promocional tem de ser inferior ao preço mais baixo dos últimos 30 dias.`,
            );
          }
          items.push({
            vehicleId: item.vehicleId,
            price: item.price,
            durationDays: item.durationDays,
            referencePrice,
            startsAt,
            endsAt: new Date(now + item.durationDays * campaignDayMs).toISOString(),
          });
        }
        for (const previous of existing.items) {
          if (previous.referencePrice === null) continue;
          if (
            items.some(
              (item) =>
                item.vehicleId === previous.vehicleId && item.startsAt === previous.startsAt,
            )
          )
            continue;
          const endedAt = Math.min(now, Date.parse(previous.endsAt));
          if (endedAt > cutoff)
            recent.push({
              vehicleId: previous.vehicleId,
              price: previous.price,
              endedAt: new Date(endedAt).toISOString(),
            });
        }
        const revision = randomUUID();
        const value = { revision, items, recent };
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
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (error) {
    if (['P2034', 'P2002'].includes((error as { code?: string }).code ?? '')) {
      throw new CampaignConflict(
        'As campanhas foram alteradas em simultâneo. Recarregue antes de guardar.',
      );
    }
    throw error;
  }
}
