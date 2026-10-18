import express from 'express';
import sharp from 'sharp';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  db: {
    vehicle: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    publicVehicleArchive: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  read: vi.fn(),
}));
vi.mock('../../db.js', () => ({ prisma: mocks.db }));
vi.mock('../../logger.js', () => ({ logger: { error: vi.fn() } }));
vi.mock('./photoVariants.js', () => ({ readPhotoBytes: mocks.read }));
vi.mock('../../middleware/clerk.js', () => ({
  requireUser: (
    req: express.Request & { user?: unknown },
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (req.headers.authorization !== 'owner') {
      res.status(401).end();
      return;
    }
    req.user = { id: 'owner', role: 'ADMIN' };
    next();
  },
}));
import {
  archiveOrigin,
  prepareArchivePhoto,
  syncPublishedArchive,
  revokeArchivePhotos,
  readPublicArchive,
  readPublicArchivePhoto,
} from './publicArchive.js';
import { setWebPublication } from './webPublicationService.js';
import publicRouter from '../../routes/publicVehicles.js';
import ownerRouter from '../../routes/publicArchives.js';

const id = 'c' + '1'.repeat(24),
  slug = 'bmw-serie-1-2019-123456789abc';
const photo = `${id}/12345678-1234-1234-1234-123456789abc.webp`,
  privatePhoto = `${id}/12345678-1234-1234-1234-123456789abd.webp`;
const source = () => ({
  id,
  slug,
  brand: 'BMW',
  model: 'Série 1',
  year: 2019,
  photos: [photo, privatePhoto],
  approved: [photo],
});
let vehicle: Record<string, any> | null;
let archives: Map<string, Record<string, any>>;
const db = mocks.db as unknown as PrismaClient;
let pixels: Buffer, server: Server, base: string;
beforeAll(async () => {
  pixels = await sharp({ create: { width: 1000, height: 700, channels: 3, background: 'red' } })
    .webp()
    .toBuffer();
  const app = express();
  app.use(express.json());
  app.use('/public', publicRouter);
  app.use('/owner', ownerRouter);
  app.use(
    (_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
      res.status(503).json({ error: 'Unavailable' }),
  );
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  vi.clearAllMocks();
  archives = new Map();
  vehicle = {
    ...source(),
    publicSlug: slug,
    publicPhotoPaths: [photo],
    webPublished: false,
    status: 'AVAILABLE',
    soldDate: null,
    sale: null,
    fuel: 'DIESEL',
    mileage: 100,
    publicPrice: null,
    publicDescription: 'Autorizado',
    publicTransmission: null,
    publicSpecifications: {},
    vin: 'PRIVATE-VIN',
    licensePlate: 'PRIVATE-PLATE',
    description: 'PRIVATE-NOTES',
  };
  mocks.read.mockResolvedValue({ buffer: pixels, contentType: 'image/webp' });
  mocks.db.vehicle.findUnique.mockImplementation(async () => vehicle);
  mocks.db.vehicle.findFirst.mockImplementation(async () =>
    vehicle?.webPublished &&
    ['AVAILABLE', 'RESERVED'].includes(vehicle.status) &&
    !vehicle.soldDate &&
    !vehicle.sale
      ? vehicle
      : null,
  );
  mocks.db.vehicle.update.mockImplementation(async ({ data }) => {
    Object.assign(vehicle!, data);
    return vehicle;
  });
  mocks.db.publicVehicleArchive.findUnique.mockImplementation(async ({ where }) => {
    const row = archives.get(where.slug);
    return row ? { ...row, vehicle } : null;
  });
  mocks.db.publicVehicleArchive.upsert.mockImplementation(async ({ where, create, update }) => {
    const row = archives.has(where.slug)
      ? { ...archives.get(where.slug), ...update }
      : { photoSourcePath: null, photoBytes: null, ...create };
    archives.set(where.slug, row);
    return row;
  });
  mocks.db.publicVehicleArchive.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const row of archives.values())
      if (
        row.vehicleId === where.vehicleId &&
        row.photoSourcePath &&
        !where.photoSourcePath.notIn.includes(row.photoSourcePath)
      ) {
        Object.assign(row, data);
        count++;
      }
    return { count };
  });
  mocks.db.publicVehicleArchive.update.mockImplementation(async ({ where, data }) => {
    const row = archives.get(where.slug)!;
    Object.assign(row, data);
    return row;
  });
  mocks.db.publicVehicleArchive.findMany.mockImplementation(async () =>
    [...archives.values()].map(({ photoBytes, photoSourcePath, ...row }) => ({
      slug: row.slug,
      brand: row.brand,
      model: row.model,
      year: row.year,
      identificationAllowed: row.identificationAllowed,
      photoAllowed: row.photoAllowed,
      photoSourcePath,
      vehicle,
    })),
  );
  mocks.db.$transaction.mockImplementation(async (work) => {
    const previous = structuredClone({ vehicle, archives });
    try {
      return await work(mocks.db);
    } catch (err) {
      vehicle = previous.vehicle;
      archives = previous.archives;
      throw err;
    }
  });
});
const capture = async () => {
  const prepared = await prepareArchivePhoto(id, source().photos, source().approved);
  await syncPublishedArchive(db, source(), prepared);
};
const patch = (action: string) =>
  fetch(`${base}/owner/${slug}`, {
    method: 'PATCH',
    headers: { authorization: 'owner', 'content-type': 'application/json' },
    body: JSON.stringify({ action }),
  });

describe('minimal archive authorization and lifecycle', () => {
  it('only reads an owned explicitly approved image and stores one bounded WebP without metadata', async () => {
    const prepared = await prepareArchivePhoto(id, [privatePhoto, photo], [photo]);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(mocks.read).toHaveBeenCalledWith(photo, 800);
    const meta = await sharp(prepared!.bytes).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBeLessThanOrEqual(800);
    expect(meta.exif).toBeUndefined();
    expect(prepared!.bytes.length).toBeLessThanOrEqual(800_000);
    expect(await prepareArchivePhoto(id, [photo], [privatePhoto])).toBeUndefined();
    expect(
      await prepareArchivePhoto(id, ['other/private.jpg'], ['other/private.jpg']),
    ).toBeUndefined();
  });
  it('creates the snapshot in the successful publication transaction, never from a slug alone', async () => {
    expect(await readPublicArchive(db, slug)).toBeNull();
    await setWebPublication(
      db,
      id,
      {
        published: true,
        price: null,
        description: 'Autorizado',
        photoPaths: [photo],
        transmission: null,
      },
      'owner',
    );
    expect(archives.get(slug)?.photoBytes.length).toBeGreaterThan(0);
    expect(await readPublicArchive(db, slug)).toBeNull();
    vehicle!.webPublished = false;
    expect(await readPublicArchive(db, slug)).toEqual({
      slug,
      brand: 'BMW',
      model: 'Série 1',
      year: 2019,
      photo: `/viaturas/${slug}/arquivo/foto`,
    });
    expect(await readPublicArchivePhoto(db, slug)).toBeInstanceOf(Buffer);
  });
  it('rolls back the archive when publication audit/transaction fails', async () => {
    mocks.db.activityLog.create.mockRejectedValueOnce(new Error('Rollback'));
    await expect(
      setWebPublication(
        db,
        id,
        {
          published: true,
          price: null,
          description: 'Autorizado',
          photoPaths: [photo],
          transmission: null,
        },
        'owner',
      ),
    ).rejects.toThrow('Rollback');
    expect(archives.size).toBe(0);
    expect(vehicle!.webPublished).toBe(false);
  });
  it('does not archive a rejected sold or unapproved publication', async () => {
    vehicle!.status = 'SOLD';
    await expect(
      setWebPublication(
        db,
        id,
        {
          published: true,
          price: null,
          description: 'Autorizado',
          photoPaths: [photo],
          transmission: null,
        },
        'owner',
      ),
    ).rejects.toThrow('unsold');
    expect(archives.size).toBe(0);
  });
  it.each(['sold', 'sale', 'unpublished', 'deleted'])(
    'retains minimal evidence after %s, with no expiry or original download',
    async (state) => {
      await capture();
      if (state === 'sold') {
        vehicle!.status = 'SOLD';
        vehicle!.webPublished = true;
      } else if (state === 'sale') {
        vehicle!.sale = { id: 'sale' };
        vehicle!.webPublished = true;
      } else if (state === 'deleted') vehicle = null;
      mocks.read.mockClear();
      expect(await readPublicArchive(db, slug)).toMatchObject({ slug, brand: 'BMW' });
      expect(await readPublicArchivePhoto(db, slug)).toBeInstanceOf(Buffer);
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
  it('revokes by immutable path, keeps revocation sticky across re-publication and allows only explicit reauthorization', async () => {
    await capture();
    vehicle!.publicPhotoPaths = [];
    expect((await readPublicArchive(db, slug))?.photo).toBeNull();
    expect(await readPublicArchivePhoto(db, slug)).toBeNull();
    await revokeArchivePhotos(db, id, source().photos, []);
    expect(archives.get(slug)?.photoBytes).toBeNull();
    vehicle!.publicPhotoPaths = [photo];
    await syncPublishedArchive(db, source(), { path: photo, bytes: pixels });
    expect(archives.get(slug)?.photoAllowed).toBe(false);
    await syncPublishedArchive(db, source(), { path: photo, bytes: pixels }, true);
    expect(archives.get(slug)?.photoAllowed).toBe(true);
  });
  it('does not revoke on reordering or infer another private photo from its index', async () => {
    await capture();
    vehicle!.photos = [privatePhoto, photo];
    await revokeArchivePhotos(db, id, vehicle!.photos, [photo]);
    expect((await readPublicArchive(db, slug))?.photo).toBeTruthy();
    vehicle!.photos = [privatePhoto];
    expect(await readPublicArchivePhoto(db, slug)).toBeNull();
    await revokeArchivePhotos(db, id, [privatePhoto], [photo]);
    expect(archives.get(slug)?.photoBytes).toBeNull();
  });
  it('protects historical slug ownership and rejects stale approval/oversized bytes', async () => {
    await capture();
    expect(archives.get(slug)?.originKey).toBe(archiveOrigin(id));
    await expect(syncPublishedArchive(db, { ...source(), id: 'another' })).rejects.toThrow(
      'another vehicle',
    );
    await expect(
      syncPublishedArchive(db, source(), { path: privatePhoto, bytes: pixels }),
    ).rejects.toThrow('approval changed');
    await expect(
      syncPublishedArchive(db, source(), { path: photo, bytes: Buffer.alloc(800_001) }),
    ).rejects.toThrow();
  });
  it('fails closed when approved pixels cannot be prepared; never substitutes a private source', async () => {
    mocks.read.mockResolvedValueOnce(null);
    await expect(prepareArchivePhoto(id, source().photos, [photo])).rejects.toThrow('unavailable');
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });
});

describe('public 404 boundary and authenticated owner withdrawal', () => {
  it('returns real 404 with a minimal allowlist and independent protected photo route', async () => {
    await capture();
    const response = await fetch(`${base}/public/${slug}`);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.json();
    expect(Object.keys(body.archive).sort()).toEqual(['brand', 'model', 'photo', 'slug', 'year']);
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE|SourcePath|originKey|vehicleId|Bytes|price/);
    const image = await fetch(`${base}/public/archive/${slug}/photo`);
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toContain('image/webp');
    expect(image.headers.get('cache-control')).toContain('no-store');
  });
  it('keeps unknown/never-published generic 404 and real database failure 503', async () => {
    let response = await fetch(`${base}/public/${slug}`);
    expect(response.status).toBe(404);
    expect((await response.json()).archive).toBeUndefined();
    mocks.db.publicVehicleArchive.findUnique.mockRejectedValueOnce(new Error('PRIVATE-DB'));
    response = await fetch(`${base}/public/${slug}`);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('PRIVATE');
  });
  it('requires authentication on management and cannot authorize via the public router', async () => {
    expect((await fetch(`${base}/owner`)).status).toBe(401);
    expect(
      (
        await fetch(`${base}/owner/${slug}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: '{"action":"withdraw"}',
        })
      ).status,
    ).toBe(401);
    expect((await fetch(`${base}/public/${slug}`, { method: 'PATCH' })).status).toBe(404);
  });
  it('withdraws archived photo and identification even after physical CRM deletion; republish never restores implicitly', async () => {
    await capture();
    vehicle = null;
    expect((await patch('withdraw-photo')).status).toBe(200);
    expect(archives.get(slug)?.photoBytes).toBeNull();
    expect(await readPublicArchivePhoto(db, slug)).toBeNull();
    expect(await readPublicArchive(db, slug)).toMatchObject({ photo: null });
    expect((await patch('withdraw')).status).toBe(200);
    expect(await readPublicArchive(db, slug)).toBeNull();
    await syncPublishedArchive(db, source(), { path: photo, bytes: pixels });
    expect(archives.get(slug)?.identificationAllowed).toBe(false);
  });
  it('reauthorizes only from a currently public approved source, rejects deleted/inactive sources', async () => {
    await capture();
    await patch('withdraw');
    expect((await patch('authorize-current')).status).toBe(409);
    vehicle!.webPublished = true;
    expect((await patch('authorize-current')).status).toBe(200);
    expect(archives.get(slug)?.photoAllowed).toBe(true);
    expect(archives.get(slug)?.identificationAllowed).toBe(true);
    vehicle = null;
    expect((await patch('authorize-current')).status).toBe(409);
  });
  it('does not expose private paths or pixels in the management list and validates actions', async () => {
    await capture();
    const response = await fetch(`${base}/owner`, { headers: { authorization: 'owner' } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items[0].hasPhoto).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(
      /PRIVATE|photoBytes|photoSourcePath|originKey|vehicleId/,
    );
    expect((await patch('invented')).status).toBe(400);
  });
});
