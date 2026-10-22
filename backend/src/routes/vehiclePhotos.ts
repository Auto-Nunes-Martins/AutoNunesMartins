import { asyncHandler } from '../middleware/asyncHandler.js';
import { ensurePhotoVariants } from '../lib/server/photoVariants.js';
import express from 'express';
import {
  optimizePhoto,
  photoAdmission,
  PhotoUploadError,
  MAX_UPLOAD_BYTES,
  MAX_OUTPUT_BYTES,
} from '../lib/server/photoOptimization.js';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { Router, type Response, type Request, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  signedPhotos,
  deleteObjects,
  getSupabase,
  getBucketName,
} from '../lib/data/storage.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { param } from '../lib/http.js';
import {
  MAX_PHOTOS,
  mutateVehiclePhotos,
  PhotoMutationError,
} from '../lib/server/vehiclePhotoService.js';

const router = Router({ mergeParams: true });

const reorderSchema = z.object({
  photos: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_PHOTOS)
    .refine((photos) => new Set(photos).size === photos.length, 'Duplicate photos'),
});

/** Signed uploads/path persistence are retired: every NEW photo passes the backend pipeline. */
router.post('/upload-url', requireUser, (_req, res) => {
  res.status(410).json({ error: 'Use upload direto para /photos com o ficheiro.' });
});
router.post('/', requireUser, (req, res, next) => {
  const release = photoAdmission.acquire();
  if (!release) {
    res.setHeader('Retry-After', '3');
    res.status(429).json({ error: 'Outra fotografia está a ser processada. Tente novamente.' });
    return;
  }
  // Release only after the work settles, including disconnects during compression/storage.
  void (async () => {
    try {
      const vehicleId = param(req, 'vehicleId');
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { photos: true },
      });
      if (!vehicle) throw new PhotoMutationError(404, 'Vehicle not found');
      const uploadId = req.get('x-upload-id');
      const staged = req.get('x-edit-stage') === 'true';
      if (staged && !uploadId) throw new PhotoUploadError(400, 'Identificador de carregamento obrigatório.');
      if (uploadId && !z.string().uuid().safeParse(uploadId).success)
        throw new PhotoUploadError(400, 'Identificador de carregamento inválido.');
      const repeated = uploadId && vehicle.photos.find(path => path.startsWith(`${vehicleId}/${uploadId}.`));
      if (repeated) {
        req.resume();
        res.status(201).json({ photos: vehicle.photos, path: repeated, reused: true });
        return;
      }
      if (!staged && vehicle.photos.length >= MAX_PHOTOS)
        throw new PhotoMutationError(400, 'Máximo de 20 fotos por viatura.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.headers['content-type'] || ''))
        throw new PhotoUploadError(415, 'Formato inválido.');
      // Admission happens BEFORE reading any body. One buffer globally, queue length zero.
      await new Promise<void>((resolve, reject) =>
        express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES, inflate: false })(
          req,
          res,
          (error) => (error ? reject(error) : resolve()),
        ),
      );
      if (!Buffer.isBuffer(req.body)) throw new PhotoUploadError(400, 'Ficheiro inválido.');
      const photo = await optimizePhoto(req.body as Buffer);
      if (photo.buffer.length > MAX_OUTPUT_BYTES)
        throw new PhotoUploadError(422, 'A fotografia otimizada excede o limite de 2 MB.');
      const path = vehicleId + '/' + (uploadId ?? randomUUID()) + '.' + photo.extension;
      const { error } = await getSupabase()
        .storage.from(getBucketName())
        .upload(path, photo.buffer, { contentType: photo.contentType, upsert: false });
      if (error && uploadId) {
        // A retry can reuse this exact immutable private object, without associating it.
        const previous = await getSupabase().storage.from(getBucketName()).download(path);
        if (previous.error || !previous.data || previous.data.size > MAX_OUTPUT_BYTES ||
          createHash('sha256').update(Buffer.from(await previous.data.arrayBuffer())).digest('hex') !== createHash('sha256').update(photo.buffer).digest('hex'))
          throw new PhotoUploadError(502, 'Não foi possível preparar a fotografia.');
      } else if (error) throw new PhotoUploadError(502, 'Não foi possível guardar a fotografia.');
      try { await ensurePhotoVariants(path,photo.buffer); }
      catch { throw new PhotoUploadError(502,'Não foi possível preparar os tamanhos da fotografia. Tente guardar novamente.'); }
      if (staged) {
        res.status(201).json({ path, staged: true, bytes: photo.buffer.length, optimized: photo.optimized });
        return;
      }
      try {
        const result = await mutateVehiclePhotos(prisma, vehicleId, { type: 'append', path });
        res
          .status(201)
          .json({ photos: result.photos, path, bytes: photo.buffer.length, optimized: photo.optimized });
      } catch (error) {
        // Never delete a possibly committed photo after an uncertain database response.
        try {
          const current = await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            select: { photos: true },
          });
          if (!current?.photos.includes(path)) await deleteObjects([path]);
        } catch {
          /* orphan cleanup is preferable to deleting a referenced photo */
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof PhotoUploadError) {
        res.status(error.status).json({ error: error.message });
      } else if (
        typeof error === 'object' &&
        error &&
        'status' in error &&
        [400, 413, 415].includes(Number(error.status))
      )
        res
          .status(Number(error.status))
          .json({ error: 'Ficheiro inválido ou acima do limite de 20 MB.' });
      else next(error);
    } finally {
      release();
    }
  })();
});

/** Reorder photos (also used to set primary by putting it at index 0). */
router.post(
  '/reorder',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const vehicleId = param(req, 'vehicleId');
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
      return;
    }

    const result = await mutateVehiclePhotos(prisma, vehicleId, {
      type: 'reorder',
      photos: parsed.data.photos,
    });
    res.json({ photos: result.photos });
  }),
);

/** Delete a photo by storage path. */
router.delete(
  '/:photoPath(*)',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const vehicleId = param(req, 'vehicleId');
    const photoPath = decodeURIComponent(param(req, 'photoPath'));

    await mutateVehiclePhotos(prisma, vehicleId, { type: 'remove', path: photoPath });

    try {
      await deleteObjects([photoPath]);
    } catch (err) {
      // Storage delete failed but DB is updated — log and continue. Orphaned objects
      // are tolerable; we never reference them again.
      console.warn('Storage delete failed:', (err as Error).message);
    }

    res.json({ ok: true });
  }),
);

/** Return signed read URLs for the current photos (1h TTL). */
router.get(
  '/signed',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const vehicleId = param(req, 'vehicleId');
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { photos: true },
    });
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    const signed = await signedPhotos(vehicle.photos);
    res.json({ photos: signed });
  }),
);

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof PhotoMutationError && !res.headersSent) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  next(error);
});

export default router;
