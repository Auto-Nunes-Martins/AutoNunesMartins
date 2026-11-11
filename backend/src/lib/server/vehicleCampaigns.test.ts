import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { campaignInput, eligibleCampaign, parseCampaigns } from '../data/campaignPricing.js';
import { CampaignConflict, readCampaignEditor, saveCampaigns } from './vehicleCampaigns.js';

const car = {
  id: 'vehicle',
  brand: 'BMW',
  model: '320d',
  year: 2021,
  licensePlate: 'AA-01-AA',
  status: 'AVAILABLE',
  publicPrice: new Prisma.Decimal(25000),
};
const offer = {
  vehicleId: car.id,
  price: '21900.00',
  durationDays: 7,
};

function fixture(hasHistory = true) {
  let value: unknown;
  const tx = {
    vehicle: { findMany: vi.fn(async () => [car]) },
    appSetting: {
      findUnique: vi.fn(async () => (value === undefined ? null : { value })),
      upsert: vi.fn(async (args) => {
        value = args.update.value;
      }),
    },
    activityLog: {
      create: vi.fn(),
      findMany: vi.fn(async () =>
        hasHistory
          ? [
              {
                entityId: car.id,
                createdAt: new Date(),
                metadata: { publicPriceHistory: '25000.00' },
              },
              {
                entityId: car.id,
                createdAt: new Date(Date.now() - 31 * 86_400_000),
                metadata: { publicPriceHistory: '23900.00' },
              },
            ]
          : [],
      ),
    },
  };
  const $transaction = vi.fn(async (run: (client: typeof tx) => unknown, _options: unknown) =>
    run(tx),
  );
  return {
    db: { ...tx, $transaction } as unknown as PrismaClient,
    tx,
    $transaction,
    setting: () => parseCampaigns(value),
  };
}

describe('public campaigns', () => {
  it('accepts an empty campaign and rejects duplicates, excess rows and supplied reference prices', () => {
    expect(campaignInput.safeParse({ revision: null, items: [] }).success).toBe(true);
    for (const items of [
      [offer, offer],
      Array.from({ length: 5 }, (_, i) => ({ ...offer, vehicleId: String(i) })),
      [{ ...offer, referencePrice: '26000.00' }],
    ]) {
      expect(campaignInput.safeParse({ revision: null, items }).success).toBe(false);
    }
  });
  it('uses the lowest historical price, keeps the original price and archives offers', async () => {
    const { db, setting, $transaction } = fixture();
    const { revision } = await saveCampaigns(db, { revision: null, items: [offer] }, 'admin');
    const item = setting().items[0]!;
    expect(Date.parse(item.endsAt) - Date.parse(item.startsAt)).toBe(7 * 86_400_000);
    expect(eligibleCampaign(car, setting().items, Date.parse(item.startsAt))).toMatchObject({
      price: offer.price,
      referencePrice: '23900.00',
    });
    expect(eligibleCampaign(car, setting().items, Date.parse(item.endsAt))).toBeUndefined();
    expect(
      eligibleCampaign({ ...car, status: 'RESERVED' }, setting().items, Date.parse(item.startsAt)),
    ).toBeUndefined();
    expect((await readCampaignEditor(db)).candidates[0]?.price).toBe('25000.00');
    expect($transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'Serializable' });
    await expect(saveCampaigns(db, { revision: null, items: [] }, 'admin')).rejects.toThrow(
      CampaignConflict,
    );
    await saveCampaigns(db, { revision, items: [] }, 'admin');
    expect(setting().items).toEqual([]);
    expect(setting().recent).toMatchObject([{ vehicleId: car.id, price: offer.price }]);
    await expect(
      saveCampaigns(db, { revision: setting().revision, items: [offer] }, 'admin'),
    ).rejects.toThrow(/últimos 30 dias/);
  });
  it('saves an offer as a draft while the price record is incomplete', async () => {
    const { db, setting } = fixture(false);
    await saveCampaigns(db, { revision: null, items: [offer] }, 'admin');
    expect(setting().items[0]?.referencePrice).toBeNull();
    expect(eligibleCampaign(car, setting().items, Date.now())).toBeUndefined();
    expect((await readCampaignEditor(db)).items).toHaveLength(1);
  });
  it('rejects unavailable vehicles and invalid price comparisons', async () => {
    const { db, tx } = fixture();
    await expect(
      saveCampaigns(db, { revision: null, items: [{ ...offer, price: '23900.00' }] }, 'admin'),
    ).rejects.toThrow(CampaignConflict);
    await expect(
      saveCampaigns(db, { revision: null, items: [{ ...offer, price: '26000.00' }] }, 'admin'),
    ).rejects.toThrow(CampaignConflict);
    tx.vehicle.findMany.mockResolvedValueOnce([]);
    await expect(saveCampaigns(db, { revision: null, items: [offer] }, 'admin')).rejects.toThrow(
      /disponível/,
    );
    expect(tx.appSetting.upsert).not.toHaveBeenCalled();
  });
});
