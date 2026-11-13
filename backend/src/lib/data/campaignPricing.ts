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
    durationDays: z.number().int().min(1).max(365),
    recheck: z.boolean().optional(),
  })
  .strict();
const newItem = inputItem.omit({ recheck: true });
const savedItem = newItem.extend({
  applied: z.literal(true).optional(),
  referencePrice: money.nullable(),
  evidence: z.string().optional(),
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
export const campaignAddition = z
  .object({
    revision: z.string().uuid().nullable(),
    item: newItem,
  })
  .strict();
const storedCampaigns = z.object({
  revision: z.string().uuid(),
  items: z.array(savedItem).max(4),
  // Old history is opaque compatibility data; it cannot affect current campaigns.
  recent: z.unknown().default([]),
});
export type CampaignInput = z.infer<typeof campaignInput>;
export type CampaignAddition = z.infer<typeof campaignAddition>;
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

export function appliedCampaign(item: SavedCampaign) {
  return item.applied === true || item.referencePrice !== null;
}

export function eligibleCampaign(
  row: { id: string; status: string; salePrice: Prisma.Decimal | null },
  items: SavedCampaign[],
  now: number,
): SavedCampaign | undefined {
  if (row.status !== 'AVAILABLE' || !row.salePrice?.gt(0)) return undefined;
  return items.find(
    (item) =>
      item.vehicleId === row.id &&
      appliedCampaign(item) &&
      currentCampaign(item, now) &&
      row.salePrice!.gt(item.price),
  );
}

export function campaignComparisonPrice(base: Prisma.Decimal | null, item?: SavedCampaign) {
  // The API keeps its existing field name, but always compares with today's base price.
  // Legacy reference prices and campaign history never participate in pricing.
  return item && base?.gt(item.price) ? base.toFixed(2) : null;
}
