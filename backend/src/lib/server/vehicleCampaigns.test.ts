import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  campaignAddition,
  campaignInput,
  eligibleCampaign,
  campaignComparisonPrice,
  parseCampaigns,
} from '../data/campaignPricing.js';
import {
  addCampaign,
  CampaignConflict,
  readCampaignEditor,
  saveCampaigns,
} from './vehicleCampaigns.js';

const car = {
  id: 'vehicle',
  brand: 'BMW',
  model: '320d',
  year: 2021,
  licensePlate: 'AA-01-AA',
  status: 'AVAILABLE',
  salePrice: new Prisma.Decimal(25000),
};
const offer = {
  vehicleId: car.id,
  price: '21900.00',
  durationDays: 7,
};

function fixture(hasHistory = true, initialValue?: unknown) {
  let value = initialValue;
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
    storedValue: () => value,
  };
}

describe('public campaigns', () => {
  it('persists reordered campaigns without restarting their timers or changing their prices', async () => {
    const { db, tx, setting } = fixture(false);
    tx.vehicle.findMany.mockResolvedValue([car, { ...car, id: 'second' }]);
    const second = { ...offer, vehicleId: 'second', price: '20000.00' };
    const { revision } = await saveCampaigns(db, { revision: null, items: [offer, second] }, 'admin');
    const original = setting().items;
    await saveCampaigns(db, { revision, items: [second, offer] }, 'admin');
    expect(setting().items).toEqual([original[1], original[0]]);
  });

  it('always compares 5000 then 4000 with the current base of 8450, never with a previous campaign', async () => {
    const { db, tx, setting } = fixture(false);
    const vehicle = { ...car, salePrice: new Prisma.Decimal('8450') };
    tx.vehicle.findMany.mockResolvedValue([vehicle]);
    const { revision } = await saveCampaigns(
      db,
      { revision: null, items: [{ ...offer, price: '5000.00' }] },
      'admin',
    );
    expect(campaignComparisonPrice(vehicle.salePrice, setting().items[0])).toBe('8450.00');
    await saveCampaigns(db, { revision, items: [{ ...offer, price: '4000.00' }] }, 'admin');
    const campaign = setting().items[0]!;
    expect(campaignComparisonPrice(vehicle.salePrice, campaign)).toBe('8450.00');
    expect(campaignComparisonPrice(new Prisma.Decimal('9000'), campaign)).toBe('9000.00');
    expect(campaignComparisonPrice(new Prisma.Decimal('4000'), campaign)).toBeNull();
    expect(
      campaignComparisonPrice(vehicle.salePrice, {
        ...campaign,
        applied: undefined,
        referencePrice: '5000.00',
      }),
    ).toBe('8450.00');
    expect(setting().recent).toEqual([]);
  });

  it('preserves legacy metadata without accumulating or using history when an offer changes', async () => {
    const revision = randomUUID();
    const recent = [
      { vehicleId: car.id, price: '1000.00', endedAt: new Date().toISOString(), note: 'preserve' },
    ];
    const previous = {
      ...offer,
      referencePrice: '23000.00',
      evidence: 'Legacy record',
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const { db, storedValue } = fixture(false, {
      revision,
      items: [previous],
      recent,
      metadata: { preserve: true },
    });
    await saveCampaigns(db, { revision, items: [{ ...offer, price: '20000.00' }] }, 'admin');
    expect(storedValue()).toMatchObject({ recent, metadata: { preserve: true } });
  });
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
  it('applies a temporary selling price, keeps the original, and stops on expiry or removal', async () => {
    const { db, tx, setting, $transaction } = fixture();
    const { revision } = await saveCampaigns(db, { revision: null, items: [offer] }, 'admin');
    const item = setting().items[0]!;
    expect(Date.parse(item.endsAt) - Date.parse(item.startsAt)).toBe(7 * 86_400_000);
    expect(eligibleCampaign(car, setting().items, Date.parse(item.startsAt))).toMatchObject({
      price: offer.price,
      applied: true,
      referencePrice: null,
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
    expect(eligibleCampaign(car, setting().items, Date.now())).toBeUndefined();
    expect(setting().recent).toEqual([]);
    expect(tx.activityLog.findMany).not.toHaveBeenCalled();
  });
  it('adds a selling price without history and preserves its start on repeated edits', async () => {
    const { db, tx, setting } = fixture(false);
    const { revision } = await addCampaign(db, { revision: null, item: offer }, 'admin');
    const original = setting().items[0]!;
    const result = await saveCampaigns(
      db,
      { revision, items: [{ ...offer, price: '22000.00' }] },
      'admin',
    );
    await saveCampaigns(
      db,
      { revision: result.revision, items: [{ ...offer, price: '22000.00' }] },
      'admin',
    );
    expect(setting().items[0]).toEqual({
      ...original,
      price: '22000.00',
      applied: true,
      referencePrice: null,
    });
    expect(tx.activityLog.findMany).not.toHaveBeenCalled();
  });
  it('retains an unchanged legacy offer without publishing it', async () => {
    const revision = randomUUID();
    const previous = {
      ...offer,
      referencePrice: null,
      startsAt: '2025-10-01T00:00:00.000Z',
      endsAt: '2025-10-08T00:00:00.000Z',
    };
    const { db, setting } = fixture(false, { revision, items: [previous] });
    await saveCampaigns(db, { revision, items: [offer] }, 'admin');
    expect(setting().items).toEqual([previous]);
    expect(eligibleCampaign(car, setting().items, Date.now())).toBeUndefined();
    expect((await readCampaignEditor(db)).items).toEqual([previous]);
  });
  it('starts the full duration only when an older draft is explicitly applied', async () => {
    const revision = randomUUID();
    const { db, setting } = fixture(true, {
      revision,
      items: [
        {
          ...offer,
          referencePrice: null,
          startsAt: '2025-10-01T00:00:00.000Z',
          endsAt: '2025-10-08T00:00:00.000Z',
        },
      ],
    });
    expect((await readCampaignEditor(db)).items).toHaveLength(1);
    const before = Date.now();
    await saveCampaigns(db, { revision, items: [{ ...offer, recheck: true }] }, 'admin');
    const item = setting().items[0]!;
    expect(item.referencePrice).toBeNull();
    expect(item.applied).toBe(true);
    expect(Date.parse(item.startsAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(item.endsAt) - Date.parse(item.startsAt)).toBe(7 * 86_400_000);
  });
  it('rejects unavailable vehicles and prices at or above the base', async () => {
    const { db, tx } = fixture();
    await expect(
      saveCampaigns(db, { revision: null, items: [{ ...offer, price: '25000.00' }] }, 'admin'),
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

describe('single campaign addition', () => {
  const previous = {
    ...offer,
    vehicleId: 'existing-vehicle',
    referencePrice: '24500.00',
    startsAt: '2025-10-01T00:00:00.000Z',
    endsAt: '2025-10-08T00:00:00.000Z',
    evidence: 'Registo original',
  };
  const original = {
    revision: randomUUID(),
    items: [previous],
    recent: [
      { vehicleId: 'older-vehicle', price: '20500.00', endedAt: previous.endsAt, extra: true },
    ],
    metadata: { preserve: true },
  };
  const addition = { revision: original.revision, item: offer };

  it('rejects replacement, edits, removals and user-supplied history', () => {
    expect(campaignAddition.safeParse(addition).success).toBe(true);
    for (const payload of [
      { revision: original.revision, items: [] },
      { ...addition, items: [offer] },
      { ...addition, remove: [previous.vehicleId] },
      { ...addition, item: { ...offer, recheck: true } },
      { ...addition, item: { ...offer, referencePrice: '26000.00' } },
      { ...addition, item: { ...offer, price: '0.00' } },
    ])
      expect(campaignAddition.safeParse(payload).success).toBe(false);
  });

  it('appends exactly one row and preserves original records and history', async () => {
    const { db, setting, storedValue, $transaction } = fixture(true, original);
    const { revision } = await addCampaign(db, addition, 'admin');
    expect(revision).not.toBe(original.revision);
    expect(storedValue()).toEqual({
      ...original,
      revision,
      items: [previous, expect.objectContaining({ ...offer, referencePrice: null, applied: true })],
    });
    expect(setting().items).toHaveLength(2);
    expect($transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('blocks duplicates, stale revisions, invalid prices and an exhausted limit', async () => {
    const { db, tx, storedValue } = fixture(true, original);
    for (const invalid of [
      { ...addition, revision: null },
      { ...addition, item: { ...offer, vehicleId: previous.vehicleId } },
      { ...addition, item: { ...offer, price: '25000.00' } },
    ])
      await expect(addCampaign(db, invalid, 'admin')).rejects.toThrow(CampaignConflict);
    expect(tx.appSetting.upsert).not.toHaveBeenCalled();
    expect(storedValue()).toEqual(original);
    const full = {
      ...original,
      items: Array.from({ length: 4 }, (_, index) => ({
        ...previous,
        vehicleId: 'existing-' + index,
      })),
    };
    const limited = fixture(true, full);
    await expect(addCampaign(limited.db, addition, 'admin')).rejects.toThrow(/limite/);
    expect(limited.storedValue()).toEqual(full);
  });
});
