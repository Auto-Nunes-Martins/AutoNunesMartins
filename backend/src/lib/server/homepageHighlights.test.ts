import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
vi.mock('../data/storage.js', () => ({
  createSignedReadUrls: vi.fn(
    async (paths: string[]) => new Map(paths.map((path) => [path, 'signed:' + path])),
  ),
}));
vi.mock('../data/activity.js', () => ({ emitActivity: vi.fn() }));
import {
  highlightsInputSchema,
  readPublicHighlights,
  readDashboardHighlights,
  readHighlightsEditor,
  saveHighlights,
} from './homepageHighlights.js';

const id = 'c123456789012345678901234';
const photo = `${id}/12345678-1234-1234-1234-123456789abc.jpg`;
const otherPhoto = `${id}/12345678-1234-1234-1234-123456789abd.jpg`;
const revision = '12345678-1234-4234-8234-123456789abc';
const fixture = () => ({
  id,
  brand: 'BMW',
  model: 'Série 3',
  year: 2022,
  fuel: 'DIESEL',
  mileage: 20000,
  status: 'AVAILABLE',
  webPublished: true,
  publicSlug: 'bmw-serie-3-123456abcdef',
  publicPrice: new Prisma.Decimal(25000),
  publicDescription: 'Approved',
  publicPhotoPaths: [photo, otherPhoto],
  publicTransmission: null,
  publicSpecifications: {},
  photos: [photo, otherPhoto],
  vin: 'PRIVATE',
  purchasePrice: 'PRIVATE',
  licensePlate: 'PRIVATE',
});
const mock = {
  appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  vehicle: { findMany: vi.fn() },
  $transaction: vi.fn(),
};
const db = mock as unknown as PrismaClient;
beforeEach(() => {
  vi.clearAllMocks();
  mock.appSetting.findUnique.mockResolvedValue({
    value: { revision, items: [{ vehicleId: id, photoPath: otherPhoto }] },
  });
  mock.vehicle.findMany.mockResolvedValue([fixture()]);
  mock.$transaction.mockImplementation((fn) => fn(mock));
});
describe('homepage editorial selection', () => {
  it('shares the exact selection, order and chosen photo with the dashboard', async () => {
    const secondId = 'c223456789012345678901234';
    const secondPhoto = `${secondId}/12345678-1234-1234-1234-123456789abc.jpg`;
    mock.appSetting.findUnique.mockResolvedValue({
      value: {
        revision,
        items: [
          { vehicleId: secondId, photoPath: secondPhoto },
          { vehicleId: id, photoPath: otherPhoto },
        ],
      },
    });
    mock.vehicle.findMany.mockResolvedValue([
      fixture(),
      {
        ...fixture(),
        id: secondId,
        publicSlug: 'audi-123456abcdef',
        photos: [secondPhoto],
        publicPhotoPaths: [secondPhoto],
      },
    ]);
    const publicResult = await readPublicHighlights(db);
    const dashboard = await readDashboardHighlights(db);
    expect(dashboard.items.map((item) => item.id)).toEqual([secondId, id]);
    expect(dashboard.items.map(({ vehicle, photoIndex }) => ({ vehicle, photoIndex }))).toEqual(
      publicResult.items,
    );
    expect(dashboard.items[0]?.licensePlate).toBe('PRIVATE');
    expect(dashboard.items[0]).not.toHaveProperty('vin');
    expect(JSON.stringify(publicResult)).not.toContain('PRIVATE');
    mock.vehicle.findMany.mockResolvedValue([]);
    expect((await readDashboardHighlights(db)).items).toEqual([]);
  });
  it('preserves the chosen photo, projects only public fields and filters with current publication rules', async () => {
    const result = await readPublicHighlights(db);
    expect(result.items[0]?.photoIndex).toBe(1);
    expect(result.items[0]?.vehicle.slug).toBe('bmw-serie-3-123456abcdef');
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|photoPath|vehicleId|signed:|\.jpg/);
    expect(mock.vehicle.findMany.mock.calls[0]![0].where).toMatchObject({
      webPublished: true,
      soldDate: null,
      sale: { is: null },
      status: { in: ['AVAILABLE', 'RESERVED'] },
    });
  });
  it('immediately omits a sold/unpublished vehicle and a revoked photo without substituting another photo', async () => {
    mock.vehicle.findMany.mockResolvedValue([]);
    expect((await readPublicHighlights(db)).items).toEqual([]);
    mock.vehicle.findMany.mockResolvedValue([{ ...fixture(), publicPhotoPaths: [photo] }]);
    expect((await readPublicHighlights(db)).items).toEqual([]);
  });
  it('recomputes the public photo index when the approved gallery is reordered', async () => {
    mock.vehicle.findMany.mockResolvedValue([
      { ...fixture(), publicPhotoPaths: [otherPhoto, photo] },
    ]);
    expect((await readPublicHighlights(db)).items[0]?.photoIndex).toBe(0);
  });
  it('supports no configuration and an intentionally empty selection', async () => {
    mock.appSetting.findUnique.mockResolvedValue(null);
    expect(await readPublicHighlights(db)).toEqual({ configured: false, items: [] });
    await expect(
      saveHighlights(db, { revision: null, items: [] }, 'admin'),
    ).resolves.toHaveProperty('revision');
    expect(mock.appSetting.upsert.mock.calls[0]![0].update.value.items).toEqual([]);
  });
  it('rejects duplicate vehicles and more than five entries', () => {
    const item = { vehicleId: id, photoPath: photo };
    expect(highlightsInputSchema.safeParse({ revision, items: [item, item] }).success).toBe(false);
    expect(
      highlightsInputSchema.safeParse({
        revision,
        items: Array.from({ length: 6 }, (_, i) => ({ ...item, vehicleId: String(i) })),
      }).success,
    ).toBe(false);
  });
  it('rejects stale writes without overwriting the winning selection', async () => {
    await expect(saveHighlights(db, { revision: null, items: [] }, 'admin')).rejects.toMatchObject({
      status: 409,
    });
    expect(mock.appSetting.upsert).not.toHaveBeenCalled();
  });
  it('rejects private, foreign, removed and no-longer-published photos', async () => {
    await expect(
      saveHighlights(
        db,
        { revision, items: [{ vehicleId: id, photoPath: 'private-document.pdf' }] },
        'admin',
      ),
    ).rejects.toMatchObject({ status: 409 });
    mock.vehicle.findMany.mockResolvedValue([]);
    await expect(
      saveHighlights(db, { revision, items: [{ vehicleId: id, photoPath: photo }] }, 'admin'),
    ).rejects.toMatchObject({ status: 409 });
    expect(mock.appSetting.upsert).not.toHaveBeenCalled();
  });
  it('saves the submitted order and selected photo in a serializable transaction', async () => {
    await saveHighlights(
      db,
      { revision, items: [{ vehicleId: id, photoPath: otherPhoto }] },
      'admin',
    );
    expect(mock.appSetting.upsert.mock.calls[0]![0].update.value.items).toEqual([
      { vehicleId: id, photoPath: otherPhoto },
    ]);
    expect(mock.$transaction.mock.calls[0]![1]).toEqual({ isolationLevel: 'Serializable' });
  });
  it('translates concurrent transaction conflicts to a retryable conflict', async () => {
    mock.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(saveHighlights(db, { revision, items: [] }, 'admin')).rejects.toMatchObject({
      status: 409,
    });
  });
  it('offers only approved images in the CRM photo picker', async () => {
    mock.vehicle.findMany.mockResolvedValue([
      { ...fixture(), publicPhotoPaths: [photo, `${id}/private.pdf`, 'other/private.jpg'] },
    ]);
    const editor = await readHighlightsEditor(db);
    expect(editor.candidates[0]?.photos).toEqual([{ path: photo, url: 'signed:' + photo }]);
  });
});
