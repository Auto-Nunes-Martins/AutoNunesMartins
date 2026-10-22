import express from 'express';
import sharp from 'sharp';
import * as optimization from '../lib/server/photoOptimization.js';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  vehicle: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  deleteObjects: vi.fn(),
  createSignedReadUrl: vi.fn(),
  signedPhotos: vi.fn(),
  upload: vi.fn(),
  logger: { error: vi.fn() },
}));
vi.mock('../db.js', () => ({ prisma: mocks }));
vi.mock('../logger.js', () => ({ logger: mocks.logger }));
vi.mock('../middleware/clerk.js', () => ({
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../lib/data/storage.js', () => ({
  deleteObjects: mocks.deleteObjects,
  createSignedReadUrl: mocks.createSignedReadUrl,
  signedPhotos: mocks.signedPhotos,
  getBucketName: () => 'photos',
  getSupabase: () => ({ storage: { from: () => ({ upload: mocks.upload }) } }),
}));
import router from './vehiclePhotos.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { MAX_PHOTOS, mutateVehiclePhotos } from '../lib/server/vehiclePhotoService.js';

const id = 'vehicle';
const a = `${id}/a.jpg`,
  b = `${id}/b.jpg`,
  c = `${id}/c.jpg`,
  d = `${id}/d.jpg`;
const rows = new Map<string, string[]>();
const publicRows = new Map<string, string[]>();
const db = mocks as unknown as Pick<PrismaClient, 'vehicle' | '$transaction'>;
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/vehicles/:vehicleId/photos', router);
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((done) => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/vehicles/${id}/photos`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.$transaction.mockImplementation(async (work) => work(mocks));
  rows.clear();
  publicRows.clear();
  rows.set(id, [a, b]);
  publicRows.set(id, [a, b]);
  // Read a snapshot. Compare-and-set is atomic, as UPDATE ... WHERE is in Postgres.
  // Concurrent services share only this database fake, with no application mutex.
  mocks.vehicle.findUnique.mockImplementation(async ({ where }) => {
    const photos = rows.get(where.id);
    return photos
      ? { photos: [...photos], publicPhotoPaths: [...(publicRows.get(where.id) ?? [])] }
      : null;
  });
  mocks.vehicle.updateMany.mockImplementation(async ({ where, data }) => {
    const current = rows.get(where.id);
    if (
      !current ||
      JSON.stringify(current) !== JSON.stringify(where.photos.equals) ||
      JSON.stringify(publicRows.get(where.id) ?? []) !==
        JSON.stringify(where.publicPhotoPaths.equals)
    )
      return { count: 0 };
    rows.set(where.id, [...data.photos.set]);
    publicRows.set(where.id, [...data.publicPhotoPaths.set]);
    return { count: 1 };
  });
  mocks.deleteObjects.mockResolvedValue(undefined);
  mocks.upload.mockResolvedValue({ error: null });
});

describe('atomic photo changes across shared database callers', () => {
  it('returns the signed gallery through one batch and keeps missing vehicles as 404', async () => {
    mocks.signedPhotos.mockResolvedValue([{ path: a, url: 'signed:a' }, { path: b, url: 'signed:b' }]);
    const response = await fetch(`${base}/signed`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ photos: [{ path: a }, { path: b }] });
    expect(mocks.signedPhotos).toHaveBeenCalledTimes(1);
    expect(mocks.signedPhotos).toHaveBeenCalledWith([a, b]);
    rows.delete(id);
    expect((await fetch(`${base}/signed`)).status).toBe(404);
    expect(mocks.signedPhotos).toHaveBeenCalledTimes(1);
  });
  it('uses the same cover/order internally and publicly without authorizing private photos', async () => {
    rows.set(id, [a, b, c]);
    publicRows.set(id, [a, c]);
    await mutateVehiclePhotos(db, id, { type: 'reorder', photos: [c, b, a] });
    expect(rows.get(id)).toEqual([c, b, a]);
    expect(publicRows.get(id)).toEqual([c, a]);
    await mutateVehiclePhotos(db, id, { type: 'remove', path: c });
    expect(publicRows.get(id)).toEqual([a]);
    await mutateVehiclePhotos(db, id, { type: 'append', path: d });
    expect(publicRows.get(id)).toEqual([a]);
  });
  it('rejects a reorder when publication permission changes during the request', async () => {
    mocks.vehicle.updateMany.mockImplementationOnce(async () => {
      publicRows.set(id, [b]);
      return { count: 0 };
    });
    await expect(
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [b, a] }),
    ).rejects.toMatchObject({ status: 409 });
    expect(publicRows.get(id)).toEqual([b]);
    expect(rows.get(id)).toEqual([a, b]);
  });
  it('preserves both concurrent uploads and the previous primary photo', async () => {
    const result = await Promise.all([
      mutateVehiclePhotos(db, id, { type: 'append', path: c }),
      mutateVehiclePhotos(db, id, { type: 'append', path: d }),
    ]);
    expect(result.every((item) => item.changed)).toBe(true);
    expect(rows.get(id)).toEqual([a, b, c, d]);
    expect(mocks.vehicle.updateMany).toHaveBeenCalledTimes(3);
    expect(mocks.vehicle.updateMany.mock.calls[1][0].where.photos.equals).toEqual([a, b]);
    expect(mocks.vehicle.updateMany.mock.calls[2][0].where.photos.equals).toEqual([a, b, c]);
  });
  it('deduplicates concurrent persistence of the same uploaded path', async () => {
    const result = await Promise.all([
      mutateVehiclePhotos(db, id, { type: 'append', path: c }),
      mutateVehiclePhotos(db, id, { type: 'append', path: c }),
    ]);
    expect(result.map((item) => item.changed)).toEqual([true, false]);
    expect(rows.get(id)).toEqual([a, b, c]);
    expect(mocks.vehicle.updateMany).toHaveBeenCalledTimes(2);
  });
  it('enforces the 20-photo limit when two uploads compete for the last slot', async () => {
    const initial = Array.from({ length: MAX_PHOTOS - 1 }, (_, i) => `${id}/${i}.jpg`);
    rows.set(id, initial);
    const result = await Promise.allSettled([
      mutateVehiclePhotos(db, id, { type: 'append', path: c }),
      mutateVehiclePhotos(db, id, { type: 'append', path: d }),
    ]);
    expect(result[0].status).toBe('fulfilled');
    expect(result[1]).toMatchObject({ status: 'rejected', reason: { status: 400 } });
    expect(rows.get(id)).toEqual([...initial, c]);
    expect(await mutateVehiclePhotos(db, id, { type: 'append', path: c })).toEqual({
      photos: [...initial, c],
      changed: false,
    });
  });
  it('recomputes an upload after a concurrent reorder and preserves the chosen primary', async () => {
    await Promise.all([
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [b, a] }),
      mutateVehiclePhotos(db, id, { type: 'append', path: c }),
    ]);
    expect(rows.get(id)).toEqual([b, a, c]);
  });
  it('rejects a reorder overtaken by an upload rather than removing its new photo', async () => {
    const result = await Promise.allSettled([
      mutateVehiclePhotos(db, id, { type: 'append', path: c }),
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [b, a] }),
    ]);
    expect(result[1]).toMatchObject({ status: 'rejected', reason: { status: 409 } });
    expect(rows.get(id)).toEqual([a, b, c]);
  });
  it.each([true, false])(
    'preserves an upload alongside a delete (upload starts first: %s)',
    async (uploadFirst) => {
      const upload = () => mutateVehiclePhotos(db, id, { type: 'append', path: c });
      const remove = () => mutateVehiclePhotos(db, id, { type: 'remove', path: a });
      await Promise.all(uploadFirst ? [upload(), remove()] : [remove(), upload()]);
      expect(rows.get(id)).toEqual([b, c]);
    },
  );
  it('recomputes deletion after a reorder without overwriting the new primary', async () => {
    rows.set(id, [a, b, c]);
    await Promise.all([
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [c, a, b] }),
      mutateVehiclePhotos(db, id, { type: 'remove', path: b }),
    ]);
    expect(rows.get(id)).toEqual([c, a]);
  });
  it('rejects a reorder overtaken by deletion instead of resurrecting the deleted photo', async () => {
    const result = await Promise.allSettled([
      mutateVehiclePhotos(db, id, { type: 'remove', path: a }),
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [b, a] }),
    ]);
    expect(result[1]).toMatchObject({ status: 'rejected', reason: { status: 409 } });
    expect(rows.get(id)).toEqual([b]);
  });
  it('compares order as well as membership when reorders race', async () => {
    rows.set(id, [a, b, c]);
    const result = await Promise.allSettled([
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [c, a, b] }),
      mutateVehiclePhotos(db, id, { type: 'reorder', photos: [b, a, c] }),
    ]);
    expect(result[1]).toMatchObject({ status: 'rejected', reason: { status: 409 } });
    expect(rows.get(id)).toEqual([c, a, b]);
  });
  it('removes both photos when two different deletions overlap', async () => {
    rows.set(id, [a, b, c]);
    await Promise.all([
      mutateVehiclePhotos(db, id, { type: 'remove', path: a }),
      mutateVehiclePhotos(db, id, { type: 'remove', path: b }),
    ]);
    expect(rows.get(id)).toEqual([c]);
  });
  it('does not retry indefinitely or swallow a database failure', async () => {
    mocks.vehicle.updateMany.mockResolvedValue({ count: 0 });
    await expect(mutateVehiclePhotos(db, id, { type: 'append', path: c })).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.vehicle.updateMany).toHaveBeenCalledTimes(3);
    expect(rows.get(id)).toEqual([a, b]);
    const error = new Error('DB unavailable');
    mocks.vehicle.updateMany.mockRejectedValue(error);
    await expect(mutateVehiclePhotos(db, id, { type: 'remove', path: a })).rejects.toBe(error);
  });
  it('handles vehicle deletion between read and write as missing on retry', async () => {
    mocks.vehicle.updateMany.mockImplementationOnce(async () => {
      rows.delete(id);
      return { count: 0 };
    });
    await expect(mutateVehiclePhotos(db, id, { type: 'append', path: c })).rejects.toMatchObject({
      status: 404,
    });
    expect(mocks.vehicle.updateMany).toHaveBeenCalledOnce();
  });
});

async function post(body: unknown, suffix = '') {
  return fetch(`${base}${suffix}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
}
const upload = (body: Buffer) =>
  fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg' },
    body,
    signal: AbortSignal.timeout(5000),
  });
const remove = (photo: string) =>
  fetch(`${base}/${encodeURIComponent(photo)}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(3000),
  });

describe('photo HTTP contract and storage boundary', () => {
  it.each([2, 20])(
    'prepares a private edit upload without associating/approving it, even with %i existing photos',
    async (count) => {
      const previous = Array.from({ length: count }, (_, index) => `${id}/existing-${index}.jpg`);
      rows.set(id, previous);
      const input = await sharp({
        create: { width: 30, height: 20, channels: 3, background: 'red' },
      })
        .jpeg()
        .toBuffer();
      const response = await fetch(base, {
        method: 'POST',
        headers: {
          'content-type': 'image/jpeg',
          'x-edit-stage': 'true',
          'x-upload-id': '12345678-1234-4234-8234-123456789abc',
        },
        body: input,
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        path: `${id}/12345678-1234-4234-8234-123456789abc.jpg`,
        staged: true,
      });
      expect(rows.get(id)).toEqual(previous);
      expect(publicRows.get(id)).toEqual([a, b]);
      expect(mocks.vehicle.updateMany).not.toHaveBeenCalled();
    },
  );
  it('rejects legacy path persistence and signed URLs so the pipeline cannot be bypassed', async () => {
    expect((await post({ path: c })).status).toBe(415);
    expect(
      (await post({ filename: 'photo.jpg', contentType: 'image/jpeg' }, '/upload-url')).status,
    ).toBe(410);
    expect(mocks.vehicle.updateMany).not.toHaveBeenCalled();
  });
  it('stores coherent bytes then appends without changing previous/public photos', async () => {
    const input = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'red' } })
      .jpeg()
      .toBuffer();
    const response = await upload(input);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.photos.slice(0, 2)).toEqual([a, b]);
    expect(data.photos[2]).toMatch(/^vehicle\/.*\.jpg$/);
    expect(publicRows.get(id)).toEqual([a, b]);
    expect(mocks.upload).toHaveBeenCalledWith(data.photos[2], input, {
      contentType: 'image/jpeg',
      upsert: false,
    });
  });
  it('rejects overlapping global uploads and releases after storage failure', async () => {
    const input = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'red' } })
      .jpeg()
      .toBuffer();
    let unblock!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    let entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    mocks.upload.mockImplementationOnce(async () => {
      entered();
      await blocked;
      return { error: new Error('fixture') };
    });
    const first = upload(input);
    await waiting;
    expect((await upload(input)).status).toBe(429);
    unblock();
    expect((await first).status).toBe(502);
    expect(rows.get(id)).toEqual([a, b]);
    expect((await upload(input)).status).toBe(201);
  });
  it('cleans up only its own unreferenced object on CAS failure and keeps old photos', async () => {
    const input = await sharp({ create: { width: 30, height: 20, channels: 3, background: 'red' } })
      .jpeg()
      .toBuffer();
    mocks.vehicle.updateMany.mockResolvedValue({ count: 0 });
    expect((await upload(input)).status).toBe(409);
    expect(rows.get(id)).toEqual([a, b]);
    expect(mocks.deleteObjects).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]]);
  });
  it('rejects stale lists with 409, duplicates with 400 and accepts valid primary selection', async () => {
    rows.set(id, [a, b, c]);
    const stale = await post({ photos: [b, a] }, '/reorder');
    expect(stale.status).toBe(409);
    expect(await stale.json()).toEqual({ error: expect.stringContaining('Atualize a página') });
    expect((await post({ photos: [a, b, b] }, '/reorder')).status).toBe(400);
    expect(mocks.vehicle.updateMany).not.toHaveBeenCalled();
    expect((await post({ photos: [c, a, b] }, '/reorder')).status).toBe(200);
    expect(rows.get(id)).toEqual([c, a, b]);
  });
  it('never writes storage if an optimizer result exceeds the 2 MB cap', async () => {
    const spy = vi.spyOn(optimization, 'optimizePhoto').mockResolvedValueOnce({
      buffer: Buffer.alloc(2_000_001),
      contentType: 'image/webp',
      extension: 'webp',
      optimized: true,
    });
    try {
      expect((await upload(Buffer.from('fixture'))).status).toBe(422);
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(rows.get(id)).toEqual([a, b]);
    } finally {
      spy.mockRestore();
    }
  });
  it('enforces capacity before decoding or storage', async () => {
    rows.set(
      id,
      Array.from({ length: MAX_PHOTOS }, (_, i) => id + '/' + i + '.jpg'),
    );
    expect((await upload(Buffer.from('fixture'))).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('deletes storage only after a successful database change and only once for concurrent deletes', async () => {
    mocks.deleteObjects.mockImplementation(async () => {
      expect(rows.get(id)).toEqual([b]);
    });
    const responses = await Promise.all([remove(a), remove(a)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 404]);
    expect(mocks.deleteObjects).toHaveBeenCalledOnce();
    expect(mocks.deleteObjects).toHaveBeenCalledWith([a]);
  });
  it('does not delete storage on exhausted conflicts or database failure', async () => {
    mocks.vehicle.updateMany.mockResolvedValue({ count: 0 });
    expect((await remove(a)).status).toBe(409);
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    mocks.vehicle.updateMany.mockRejectedValue(new Error('PRIVATE DB failure'));
    const failed = await remove(a);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'Internal server error' });
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
    expect(rows.get(id)).toEqual([a, b]);
  });
  it('keeps the photo removed if best-effort storage cleanup fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      mocks.deleteObjects.mockRejectedValue(new Error('Storage unavailable'));
      expect((await remove(a)).status).toBe(200);
      expect(rows.get(id)).toEqual([b]);
      expect((await remove(a)).status).toBe(404);
      expect(mocks.deleteObjects).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });
  it('keeps missing vehicles and photos as 404 responses', async () => {
    expect((await remove(c)).status).toBe(404);
    rows.delete(id);
    expect((await post({ path: c })).status).toBe(404);
    expect((await remove(a)).status).toBe(404);
    expect(mocks.vehicle.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteObjects).not.toHaveBeenCalled();
  });
});
