import { Prisma } from '@prisma/client';
import { beforeEach, expect, it, vi } from 'vitest';
const emit = vi.hoisted(() => vi.fn());
vi.mock('../data/activity.js', () => ({ emitActivity: emit }));
vi.mock('./preparePhotoDimensions.js', () => ({ preparePhotoDimensions: vi.fn() }));
import { applyWebPublication, assertCampaignBasePrice } from './webPublicationService';
beforeEach(() => vi.clearAllMocks());
it.each([null, '0', '-1'])('requires a positive saved sale price (%s)', async (price) => {
  const tx = {
    vehicle: {
      findUnique: vi.fn().mockResolvedValue({ salePrice: price === null ? null : new Prisma.Decimal(price) }),
      update: vi.fn(),
    },
  };
  await expect(applyWebPublication(tx as never, 'car', {
    published: true, description: 'Viatura', photoPaths: [], transmission: null,
  }, 'actor')).rejects.toMatchObject({ status: 409, field: 'salePrice' });
  expect(tx.vehicle.update).not.toHaveBeenCalled();
});
it.each([null, '4000', '4999.99', '5000'])(
  'rejects base %s while a 5000 campaign is active',
  async (price) => {
    const tx = {
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            revision: 'a27087e8-bfce-4ff2-a8c5-92f139686225',
            items: [
              {
                vehicleId: 'car',
                price: '5000.00',
                referencePrice: null,
                applied: true,
                durationDays: 7,
                startsAt: new Date(Date.now() - 1000).toISOString(),
                endsAt: new Date(Date.now() + 86400000).toISOString(),
              },
            ],
          },
        }),
      },
    };
    await expect(assertCampaignBasePrice(tx as never, 'car', price)).rejects.toMatchObject({
      status: 409,
      field: 'salePrice',
    });
    await expect(assertCampaignBasePrice(tx as never, 'car', '5000.01')).resolves.toBeUndefined();
    await expect(assertCampaignBasePrice(tx as never, 'car', '8450')).resolves.toBeUndefined();
  },
);
it.each([true, false])(
  'persists a durable vehicle identity for publication=%s',
  async (published) => {
    const vehicle = {
      id: 'car',
      brand: 'BMW',
      model: 'One',
      year: 2020,
      licensePlate: 'AA-00-AA',
      status: 'AVAILABLE',
      soldDate: null,
      sale: null,
      photos: [],
      publicSlug: 'slug',
      salePrice: new Prisma.Decimal(20000),
    };
    const tx = {
      appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
      vehicle: {
        findUnique: vi.fn().mockResolvedValue(vehicle),
        update: vi.fn().mockResolvedValue({ webPublished: published, publicSlug: 'slug' }),
      },
    };
    await applyWebPublication(
      tx as never,
      'car',
      {
        published,
        description: 'Descrição pública',
        photoPaths: [],
        transmission: null,
      } as never,
      'actor',
    );
    expect(emit.mock.calls[0]?.[1]).toMatchObject({
      actorId: 'actor',
      entityId: 'car',
      message: `${published ? 'Publicação web aprovada' : 'Publicação web desativada'}: BMW One · AA-00-AA`,
      metadata: {
        webPublished: published,
        vehicle: { brand: 'BMW', model: 'One', year: 2020, licensePlate: 'AA-00-AA' },
      },
    });
  },
);
