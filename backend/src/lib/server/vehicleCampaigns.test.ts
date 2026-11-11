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
  referencePrice: '23900.00',
  evidence: 'Registo de preços n.º 42',
  durationDays: 7,
};

function fixture() {
  let value: unknown;
  const tx = {
    vehicle: { findMany: vi.fn(async () => [car]) },
    appSetting: {
      findUnique: vi.fn(async () => (value === undefined ? null : { value })),
      upsert: vi.fn(async (args) => {
        value = args.update.value;
      }),
    },
    activityLog: { create: vi.fn() },
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
  it('accepts an empty campaign and rejects duplicate vehicles, excess rows and missing evidence', () => {
    expect(campaignInput.safeParse({ revision: null, items: [] }).success).toBe(true);
    for (const items of [
      [offer, offer],
      Array.from({ length: 5 }, (_, i) => ({ ...offer, vehicleId: String(i) })),
      [{ ...offer, evidence: '' }],
    ]) {
      expect(campaignInput.safeParse({ revision: null, items }).success).toBe(false);
    }
  });
  it('stores a separate public price, proof and duration, while keeping the original price', async () => {
    const { db, setting, $transaction } = fixture();
    const { revision } = await saveCampaigns(db, { revision: null, items: [offer] }, 'admin');
    const item = setting().items[0]!;
    expect(Date.parse(item.endsAt) - Date.parse(item.startsAt)).toBe(7 * 86_400_000);
    expect(eligibleCampaign(car, setting().items, Date.parse(item.startsAt))).toMatchObject({
      price: offer.price,
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
  it('rejects unavailable vehicles and invalid price comparisons', async () => {
    const { db, tx } = fixture();
    await expect(
      saveCampaigns(
        db,
        { revision: null, items: [{ ...offer, price: offer.referencePrice }] },
        'admin',
      ),
    ).rejects.toThrow(CampaignConflict);
    await expect(
      saveCampaigns(
        db,
        { revision: null, items: [{ ...offer, referencePrice: '26000.00' }] },
        'admin',
      ),
    ).rejects.toThrow(CampaignConflict);
    tx.vehicle.findMany.mockResolvedValueOnce([]);
    await expect(saveCampaigns(db, { revision: null, items: [offer] }, 'admin')).rejects.toThrow(
      /disponível/,
    );
    expect(tx.appSetting.upsert).not.toHaveBeenCalled();
  });
});
