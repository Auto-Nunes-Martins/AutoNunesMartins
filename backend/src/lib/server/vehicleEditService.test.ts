import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({
  work: vi.fn(),
  update: vi.fn(),
  publication: vi.fn(),
  lock: vi.fn(),
  download: vi.fn(),
}));
vi.mock('../../db.js', () => ({ prisma: {} }));
vi.mock('./saleFinancials.js', () => ({ saleMutation: mocked.work, lockVehicle: mocked.lock }));
vi.mock('./vehicleService.js', () => ({
  updateVehicleInTransaction: mocked.update,
  VehicleNotFound: class extends Error {},
  VehicleStateConflict: class extends Error {
    status = 409;
  },
}));
vi.mock('./webPublicationService.js', () => ({
  applyWebPublication: mocked.publication,
  WebPublicationError: class extends Error {
    constructor(
      public status: number,
      message: string,
      public field?: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('../data/storage.js', () => ({
  getBucketName: () => 'fixture',
  getSupabase: () => ({ storage: { from: () => ({ download: mocked.download }) } }),
}));
import { saveVehicleEdit, vehicleEditSchema } from './vehicleEditService.js';
import sharp from 'sharp';
const id = 'c' + '1'.repeat(24),
  a = `${id}/12345678-1234-1234-1234-123456789abc.jpg`,
  b = `${id}/12345678-1234-1234-1234-123456789abd.webp`;
let row: {
  updatedAt: Date;
  photos: string[];
  publicPhotoPaths: string[];
  brand: string;
  webPublished: boolean;
};
let tx: { vehicle: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
const actor = { actorId: 'admin', actorName: 'Admin' };
const input = () =>
  vehicleEditSchema.parse({
    expectedUpdatedAt: '2026-10-17T10:00:00.000Z',
    data: { brand: 'Nova marca' },
    photos: [a, b],
    publication: {
      published: true,
      price: '20000',
      description: 'Público',
      photoPaths: [b],
      transmission: null,
      specifications: {},
    },
  });
it('rejects a formatted description with no visible text when publishing, but permits it in a private draft', () => {
  const value = input();
  value.publication!.description = '<!--anm:rich-description:v1--><p><br></p>';
  expect(vehicleEditSchema.safeParse(value).success).toBe(false);
  value.publication!.published = false;
  expect(vehicleEditSchema.safeParse(value).success).toBe(true);
});
beforeEach(() => {
  vi.clearAllMocks();
  row = {
    updatedAt: new Date('2026-10-17T10:00:00.000Z'),
    photos: [a, b],
    publicPhotoPaths: [a],
    brand: 'Original',
    webPublished: true,
  };
  tx = {
    vehicle: {
      findUnique: vi.fn(async () => structuredClone(row)),
      update: vi.fn(async ({ data }) => {
        if (data.photos) row.photos = data.photos.set;
        if (data.publicPhotoPaths)
          row.publicPhotoPaths = data.publicPhotoPaths.set ?? data.publicPhotoPaths;
        if (data.updatedAt) row.updatedAt = data.updatedAt;
        return row;
      }),
    },
  };
  mocked.work.mockImplementation(async (work) => {
    const before = structuredClone(row);
    try {
      return await work(tx);
    } catch (error) {
      row = before;
      throw error;
    }
  });
  mocked.update.mockImplementation(async (_tx, _id, data) => {
    row.brand = data.brand;
  });
  mocked.publication.mockImplementation(async (_tx, _id, publication) => {
    row.webPublished = publication.published;
    if (publication.published) row.publicPhotoPaths = publication.photoPaths;
  });
});
describe('single vehicle edit transaction', () => {
  it('rejects deselection of the announcement principal atomically and reports a photo field', async () => {
    await expect(saveVehicleEdit(id, input(), actor)).rejects.toMatchObject({
      status: 409,
      field: 'publication.photoPaths',
    });
    expect(row.photos).toEqual([a, b]);
    expect(row.publicPhotoPaths).toEqual([a]);
    expect(mocked.update).not.toHaveBeenCalled();
  });
  it('rejects clearing the now-required plate and accepts clearing an optional VIN', async () => {
    expect(vehicleEditSchema.safeParse({ ...input(), data: { licensePlate: null } }).success).toBe(false);
    const value = vehicleEditSchema.parse({ ...input(), publication: undefined, data: { vin: '' } });
    await saveVehicleEdit(id, value, actor);
    expect(mocked.update.mock.calls[0]?.[2]).toEqual({ vin: null });
  });
  it('commits internal fields, chosen order and explicit approval through one transaction', async () => {
    const value = input();
    value.photos = [b, a];
    await saveVehicleEdit(id, value, actor);
    expect(mocked.work).toHaveBeenCalledTimes(1);
    expect(row.brand).toBe('Nova marca');
    expect(row.photos).toEqual([b, a]);
    expect(row.publicPhotoPaths).toEqual([b]);
    expect(mocked.update.mock.calls[0]?.[0]).toBe(tx);
    expect(mocked.publication.mock.calls[0]?.[0]).toBe(tx);
  });
  it('rolls back internal fields and order when public approval fails', async () => {
    mocked.publication.mockRejectedValueOnce(new Error('Publication rejected'));
    await expect(saveVehicleEdit(id, { ...input(), photos: [b] }, actor)).rejects.toThrow(
      'Publication rejected',
    );
    expect(row.brand).toBe('Original');
    expect(row.photos).toEqual([a, b]);
    expect(row.publicPhotoPaths).toEqual([a]);
  });
  it('rejects a stale revision before any mutation or approval', async () => {
    row.updatedAt = new Date('2026-10-17T10:00:01Z');
    await expect(saveVehicleEdit(id, input(), actor)).rejects.toThrow('alterada entretanto');
    expect(mocked.update).not.toHaveBeenCalled();
    expect(mocked.publication).not.toHaveBeenCalled();
  });
  it('cannot attach an undeclared or other-vehicle path', async () => {
    await expect(
      saveVehicleEdit(id, { ...input(), photos: ['other/private.jpg'] }, actor),
    ).rejects.toThrow('não pertence');
    await expect(
      saveVehicleEdit(id, { ...input(), uploadedPhotos: ['other/private.jpg'] }, actor),
    ).rejects.toThrow('preparada inválida');
    expect(mocked.download).not.toHaveBeenCalled();
    expect(mocked.update).not.toHaveBeenCalled();
  });
  it('does not authorize an existing private photo when only order changes', async () => {
    await expect(
      saveVehicleEdit(id, { ...input(), photos: [b, a], publication: undefined }, actor),
    ).rejects.toThrow('foto principal');
    expect(row.publicPhotoPaths).toEqual([a]);
    expect(mocked.publication).not.toHaveBeenCalled();
    expect(row.photos).toEqual([a, b]);
  });
  it('removes a photo and its public approval together', async () => {
    row.publicPhotoPaths = [a, b];
    const result = await saveVehicleEdit(
      id,
      { ...input(), photos: [b], publication: undefined },
      actor,
    );
    expect(result.removedPhotos).toEqual([a]);
    expect(row.publicPhotoPaths).toEqual([b]);
  });
  it('attaches a verified staged private image without authorizing it implicitly', async () => {
    row.webPublished = false;
    const path = `${id}/12345678-1234-1234-1234-123456789abe.webp`;
    const buffer = await sharp({ create: { width: 8, height: 12, channels: 3, background: 'red' } })
      .webp()
      .toBuffer();
    mocked.download.mockResolvedValueOnce({
      data: new Blob([buffer], { type: 'image/webp' }),
      error: null,
    });
    await saveVehicleEdit(
      id,
      { ...input(), photos: [path, a], uploadedPhotos: [path], publication: undefined },
      actor,
    );
    expect(row.photos).toEqual([path, a]);
    expect(row.publicPhotoPaths).toEqual([a]);
    expect(mocked.publication).not.toHaveBeenCalled();
  });
  it('rejects unavailable or non-image staged objects before any transaction', async () => {
    mocked.download.mockResolvedValueOnce({
      data: new Blob(['html'], { type: 'text/html' }),
      error: null,
    });
    await expect(saveVehicleEdit(id, { ...input(), uploadedPhotos: [b] }, actor)).rejects.toThrow(
      'já não está disponível',
    );
    expect(mocked.work).not.toHaveBeenCalled();
  });
});
