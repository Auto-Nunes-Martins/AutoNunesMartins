import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '@prisma/client';
vi.mock('../data/storage.js', () => ({
  signedPhotos: vi.fn(async (paths: string[]) => paths.map((path) => ({ path, url: 'signed:' + path }))),
  signedThumbnails: vi.fn(async (paths: string[]) => ({
    thumbnails: new Map(paths.map((path) => [path, 'thumbnail:' + path])),
    originals: new Map(paths.map((path) => [path, 'signed:' + path])),
  })),
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
  readHighlightPreviews,
  readHighlightGallery,
  saveHighlights,
} from './homepageHighlights.js';
import { signedPhotos, signedThumbnails } from '../data/storage.js';

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
  vehicle: { findMany: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
};
const db = {
  ...mock,
  appSetting: {
    ...mock.appSetting,
    findUnique: (args: { where: { key: string } }) =>
      args.where.key === 'publicVehicleCampaigns' ? Promise.resolve(null) : mock.appSetting.findUnique(args),
  },
} as unknown as PrismaClient;
beforeEach(() => {
  vi.clearAllMocks();
  mock.appSetting.findUnique.mockResolvedValue({
    value: { revision, items: [{ vehicleId: id, photoPath: otherPhoto }] },
  });
  mock.vehicle.findMany.mockResolvedValue([fixture()]);
  mock.$transaction.mockImplementation((fn) => fn(mock));
});
describe('homepage editorial selection', () => {
  it('returns the public gallery cover crop for the candidate thumbnail', async () => {
    const coverFraming = { desktop: { x: 22, y: 63 }, mobile: { x: 71, y: 29 } };
    const otherFraming = { desktop: { x: 15, y: 90 }, mobile: { x: 42, y: 70 } };
    mock.vehicle.findMany.mockResolvedValue([
      {
        ...fixture(),
        galleryFraming: {
          [photo]: { ...coverFraming, card: otherFraming },
          [otherPhoto]: otherFraming,
        },
      },
    ]);
    const editor = await readHighlightsEditor(db);
    expect(editor.candidates[0]).toMatchObject({ photoPaths: [photo, otherPhoto], coverFraming });
    expect(editor.candidates[0]?.coverFraming).toEqual(coverFraming);
    expect(editor.items[0]?.photoPath).toBe(otherPhoto);
  });

  it('validates and carries a highlight crop separately from gallery framing without private paths', async () => {
    const framing = { desktop: { x: 50, y: 80 }, mobile: { x: 50, y: 65 } };
    const selection = { revision, items: [{ vehicleId: id, photoPath: otherPhoto, framing }] };
    expect(highlightsInputSchema.parse(selection)).toEqual(selection);
    expect(
      highlightsInputSchema.safeParse({
        ...selection,
        items: [
          { ...selection.items[0], framing: { desktop: { x: 101, y: 0 }, mobile: { x: 0, y: 0 } } },
        ],
      }).success,
    ).toBe(false);
    mock.appSetting.findUnique.mockResolvedValue({ value: selection });
    const result = await readPublicHighlights(db);
    expect(result.items[0]?.framing).toEqual(framing);
    expect((await readDashboardHighlights(db)).items[0]?.framing).toEqual(framing);
    expect(result.items[0]?.vehicle).not.toHaveProperty('galleryFraming');
    expect(JSON.stringify(result)).not.toContain(otherPhoto);
  });
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
    const hidden = await readDashboardHighlights(db);
    expect(hidden.items).toEqual([]);
    expect(hidden.configuredVehicleIds).toEqual([secondId, id]);
    expect(publicResult).not.toHaveProperty('configuredVehicleIds');
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
  it('immediately omits a sold/unpublished vehicle and a removed photo without substituting another photo', async () => {
    mock.vehicle.findMany.mockResolvedValue([]);
    expect((await readPublicHighlights(db)).items).toEqual([]);
    mock.vehicle.findMany.mockResolvedValue([{ ...fixture(), photos: [photo] }]);
    expect((await readPublicHighlights(db)).items).toEqual([]);
  });
  it('recomputes the independent homepage selection index when vehicle order changes', async () => {
    mock.vehicle.findMany.mockResolvedValue([
      { ...fixture(), photos: [otherPhoto, photo], publicPhotoPaths: [otherPhoto, photo] },
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
  it('lists current photo paths without waiting for unavailable Storage', async () => {
    mock.vehicle.findMany.mockResolvedValue([
      { ...fixture(), publicPhotoPaths: [photo, `${id}/private.pdf`, 'other/private.jpg'] },
    ]);
    vi.mocked(signedPhotos).mockRejectedValueOnce(new Error('Storage unavailable'));
    const editor = await readHighlightsEditor(db);
    expect(editor.candidates[0]?.photoPaths).toEqual([photo, otherPhoto]);
    expect(signedPhotos).not.toHaveBeenCalled();
    expect(signedThumbnails).not.toHaveBeenCalled();
    mock.vehicle.findFirst.mockResolvedValue(fixture());
    await expect(readHighlightGallery(db, id)).rejects.toThrow('Storage unavailable');
  });
  it('signs only requested, still-approved previews and only the selected gallery', async () => {
    const removed = `${id}/12345678-1234-1234-1234-123456789abe.jpg`;
    expect(await readHighlightPreviews(db, [otherPhoto, otherPhoto, removed])).toEqual([
      { path: otherPhoto, url: `thumbnail:${otherPhoto}`, originalUrl: `signed:${otherPhoto}` },
    ]);
    expect(signedThumbnails).toHaveBeenCalledTimes(1);
    expect(signedThumbnails).toHaveBeenCalledWith([otherPhoto]);
    expect(signedPhotos).not.toHaveBeenCalled();
    mock.vehicle.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(fixture());
    expect(await readHighlightGallery(db, id)).toBeNull();
    expect(signedPhotos).not.toHaveBeenCalled();
    expect(await readHighlightGallery(db, id)).toHaveLength(2);
    expect(signedPhotos).toHaveBeenCalledTimes(1);
    expect(signedPhotos).toHaveBeenCalledWith([photo, otherPhoto]);
    expect(mock.vehicle.findFirst.mock.calls[0]?.[0].where).toMatchObject({ id, webPublished: true, sale: { is: null } });
  });
});
