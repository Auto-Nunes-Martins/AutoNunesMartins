import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
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
  return {
    revision: campaigns.revision,
    items: campaigns.items.filter((item) => currentCampaign(item, Date.now())),
    candidates: vehicles.map(({ publicPrice, ...vehicle }) => ({
      ...vehicle,
      price: publicPrice!.toFixed(2),
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
        const items: SavedCampaign[] = [];
        for (const item of input.items) {
          const vehicle = vehicles.find(({ id }) => id === item.vehicleId);
          if (!vehicle?.publicPrice?.gt(0)) {
            throw new CampaignConflict(
              'Uma das viaturas deixou de estar disponível no site. Reveja a seleção.',
            );
          }
          const name = `${vehicle.brand} ${vehicle.model}`;
          if (
            Number(item.price) >= Number(item.referencePrice) ||
            vehicle.publicPrice.lt(item.referencePrice)
          ) {
            throw new CampaignConflict(
              `${name}: o preço promocional tem de ser inferior à referência, e a referência não pode superar o preço público normal.`,
            );
          }
          const previous = existing.items.find(({ vehicleId }) => vehicleId === item.vehicleId);
          if (
            previous &&
            currentCampaign(previous, now) &&
            previous.price === item.price &&
            previous.referencePrice === item.referencePrice &&
            previous.durationDays === item.durationDays
          ) {
            items.push({ ...previous, evidence: item.evidence });
            continue;
          }
          const knownPrices = recent
            .filter(({ vehicleId }) => vehicleId === item.vehicleId)
            .map(({ price }) => Number(price));
          if (previous && Date.parse(previous.endsAt) > cutoff)
            knownPrices.push(Number(previous.price));
          if (knownPrices.some((price) => price < Number(item.referencePrice))) {
            throw new CampaignConflict(
              `${name}: já existe um preço promocional inferior à referência nos últimos 30 dias.`,
            );
          }
          items.push({
            ...item,
            startsAt,
            endsAt: new Date(now + item.durationDays * campaignDayMs).toISOString(),
          });
        }
        for (const previous of existing.items) {
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
