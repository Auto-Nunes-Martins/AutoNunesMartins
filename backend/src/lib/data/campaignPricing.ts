import type { Prisma } from '@prisma/client';
import { z } from 'zod';

export const campaignKey = 'publicVehicleCampaigns';
export const campaignDayMs = 86_400_000;
const money = z
  .string()
  .regex(/^\d{1,10}\.\d{2}$/)
  .refine((value) => Number(value) > 0);
const inputItem = z
  .object({
    vehicleId: z.string().min(1).max(100),
    price: money,
    referencePrice: money,
    evidence: z.string().trim().min(3).max(400),
    durationDays: z.number().int().min(1).max(365),
  })
  .strict();
const savedItem = inputItem.extend({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});
export const campaignInput = z
  .object({
    revision: z.string().uuid().nullable(),
    items: z
      .array(inputItem)
      .max(4)
      .refine((items) => new Set(items.map((item) => item.vehicleId)).size === items.length),
  })
  .strict();
const storedCampaigns = z.object({
  revision: z.string().uuid(),
  items: z.array(savedItem).max(4),
  recent: z
    .array(z.object({ vehicleId: z.string(), price: money, endedAt: z.string().datetime() }))
    .default([]),
});
export type CampaignInput = z.infer<typeof campaignInput>;
export type SavedCampaign = z.infer<typeof savedItem>;

export function parseCampaigns(value: unknown) {
  return value === undefined
    ? {
        revision: null,
        items: [] as SavedCampaign[],
        recent: [] as z.infer<typeof storedCampaigns>['recent'],
      }
    : storedCampaigns.parse(value);
}

export async function readCampaigns(db: Pick<Prisma.TransactionClient, 'appSetting'>) {
  const setting = await db.appSetting.findUnique({ where: { key: campaignKey } });
  return parseCampaigns(setting?.value);
}

export function currentCampaign(item: SavedCampaign, now: number) {
  return Date.parse(item.startsAt) <= now && now < Date.parse(item.endsAt);
}

export function eligibleCampaign(
  row: { id: string; status: string; publicPrice: Prisma.Decimal | null },
  items: SavedCampaign[],
  now: number,
) {
  if (row.status !== 'AVAILABLE' || !row.publicPrice?.gt(0)) return undefined;
  return items.find(
    (item) =>
      item.vehicleId === row.id &&
      currentCampaign(item, now) &&
      row.publicPrice!.gte(item.referencePrice) &&
      Number(item.price) < Number(item.referencePrice),
  );
}
