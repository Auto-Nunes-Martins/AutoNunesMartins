import { asyncHandler } from '../middleware/asyncHandler.js';
import { PhotoEncodingSession } from '../lib/server/photoEncodingSession.js';
import { ensurePhotoVariants } from '../lib/server/photoVariants.js';
import { persistPhotoDimensions } from '../lib/data/photoDimensions.js';
import { logger } from '../logger.js';
import { cleanupLateVehicleUpload } from '../lib/server/vehiclePhotoCleanup.js';
import { sanitizePhotoMetadata } from '../lib/server/photoMetadata.js';
import express from 'express';
import {
  beginPhotoUpload,
  checkPhotoUpload,
  finishPhotoUpload,
  failPhotoUpload,
  retainStagedPhotos,
  discardStagedPhotos,
  processPhotoJob,
  PhotoLifecycleError,
} from '../lib/server/photoLifecycleStore.js';
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
import {
  galleryPhotoFramingSchema,
  galleryFramingSchema,
  mergeGalleryPhotoFraming,
} from '@anm/types';
import { lockVehicle } from '../lib/server/saleFinancials.js';
import { cache } from '../lib/data/cache.js';
import { prisma } from '../db.js';
import { signedPhotos, getSupabase, getBucketName } from '../lib/data/storage.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { param } from '../lib/http.js';
import {
  MAX_PHOTOS,
  mutateVehiclePhotos,
  PhotoMutationError,
} from '../lib/server/vehiclePhotoService.js';

const router = Router({ mergeParams: true });
const stagingSchema = z
  .object({ action: z.enum(['retain', 'discard']), paths: z.array(z.string().max(160)).max(20) })
  .strict();
router.post(
  '/staging',
  requireUser,
  asyncHandler(async (req, res) => {
    const input = stagingSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: 'Fotografias preparadas inválidas.' });
      return;
    }
    const id = param(req, 'vehicleId');
    if (input.data.action === 'discard') {
      await discardStagedPhotos(id, input.data.paths);
      res.json({ ok: true });
      return;
    }
    const { adopted } = await retainStagedPhotos(id, input.data.paths);
    const missingPaths: string[] = [];
    for (const path of adopted) {
      const { data, error } = await getSupabase().storage.from(getBucketName()).info(path);
      if (!data && String(error?.statusCode) === '404') missingPaths.push(path);
      else if (error)
        throw new PhotoLifecycleError(
          'Não foi possível confirmar as fotografias preparadas. Tente novamente.',
          503,
        );
    }
    if (missingPaths.length) await discardStagedPhotos(id, missingPaths);
    res.json({ ok: true, missingPaths });
  }),
);
const framingInput = z
  .object({ path: z.string().min(1).max(160), framing: galleryPhotoFramingSchema.nullable() })
  .strict();
router.post(
  '/framing',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = framingInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Enquadramento inválido.', issues: parsed.error.issues });
      return;
    }
    const id = param(req, 'vehicleId');
    const result = await prisma.$transaction(async (tx) => {
      await lockVehicle(tx, id);
      const vehicle = await tx.vehicle.findUnique({
        where: { id },
        select: { photos: true, galleryFraming: true },
      });
      if (!vehicle || !vehicle.photos.includes(parsed.data.path)) return null;
      const framing = galleryFramingSchema.parse(vehicle.galleryFraming);
      const next = mergeGalleryPhotoFraming(framing[parsed.data.path], parsed.data.framing);
      if (next) framing[parsed.data.path] = next;
      else delete framing[parsed.data.path];
      const cleaned = Object.fromEntries(
        Object.entries(framing).filter(([path]) => vehicle.photos.includes(path)),
      );
      await tx.vehicle.update({ where: { id }, data: { galleryFraming: cleaned } });
      return cleaned;
    });
    if (!result) {
      res.status(404).json({ error: 'Fotografia não encontrada.' });
      return;
    }
    cache.clearPrefix('dashboard:');
    res.json({ galleryFraming: result });
  }),
);

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
  let encoding: PhotoEncodingSession | undefined;
  let storedPath: string | undefined;
  let uploadLease: { path: string; token: string } | undefined;
  let leaseTimer: NodeJS.Timeout | undefined;
  let completed = false;
  let preserveExistingUpload = false;
  const aborted = () => {
    encoding?.abort();
  };
  const closed = () => {
    if (!res.writableEnded) aborted();
  };
  req.once('aborted', aborted);
  res.once('close', closed);
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
      if (staged && !uploadId)
        throw new PhotoUploadError(400, 'Identificador de carregamento obrigatório.');
      if (uploadId && !z.string().uuid().safeParse(uploadId).success)
        throw new PhotoUploadError(400, 'Identificador de carregamento inválido.');
      const repeated =
        uploadId && vehicle.photos.find((path) => path.startsWith(`${vehicleId}/${uploadId}.`));
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

      // Production isolates all large pixel decoding/encoding. Explicit inline mode
      // remains available as a bounded rollback; tests/development keep their existing mode.
      if (process.env.NODE_ENV === 'production' && process.env.PHOTO_PROCESSING_MODE !== 'inline')
        encoding = new PhotoEncodingSession();
      const photo = encoding
        ? await encoding.optimize(req.body as Buffer)
        : await optimizePhoto(req.body as Buffer);
      req.body = undefined;

      if (photo.buffer.length > MAX_OUTPUT_BYTES)
        throw new PhotoUploadError(422, 'A fotografia otimizada excede o limite de 2 MB.');
      const path = vehicleId + '/' + (uploadId ?? randomUUID()) + '.' + photo.extension;
      uploadLease = await beginPhotoUpload(vehicleId, path);
      storedPath = path;
      leaseTimer = setInterval(() => {
        void checkPhotoUpload(path, uploadLease!.token).catch(() => encoding?.abort());
      }, 30000);
      leaseTimer.unref();
      let storedMaster = photo.buffer;

      await checkPhotoUpload(path, uploadLease.token);
      const { error } = await getSupabase()
        .storage.from(getBucketName())
        .upload(path, photo.buffer, { contentType: photo.contentType, upsert: false });
      if (error && uploadId) {
        // Never delete a previous immutable staged object after an ambiguous conflict/read.
        preserveExistingUpload = true;
        // A retry can reuse this exact immutable private object, without associating it.
        const previous = await getSupabase().storage.from(getBucketName()).download(path);
        if (previous.error || !previous.data || previous.data.size > MAX_OUTPUT_BYTES)
          throw new PhotoUploadError(502, 'Não foi possível preparar a fotografia.');
        storedMaster = Buffer.from(await previous.data.arrayBuffer());
        // A staged upload created before metadata filtering may be retried after deploy.
        // Compare the cleaned representation, but keep its immutable stored identity/hash.
        if (
          createHash('sha256')
            .update(await sanitizePhotoMetadata(storedMaster))
            .digest('hex') !== createHash('sha256').update(photo.buffer).digest('hex')
        )
          throw new PhotoUploadError(502, 'Não foi possível preparar a fotografia.');
      } else if (error) throw new PhotoUploadError(502, 'Não foi possível guardar a fotografia.');
      try {
        const { manifest } = await ensurePhotoVariants(
          path,
          storedMaster,
          encoding
            ? async (input) => {
                try {
                  return await encoding!.variants(input);
                } finally {
                  await encoding!.close();
                }
              }
            : undefined,
          () => checkPhotoUpload(path, uploadLease!.token),
        );
        await encoding?.close();

        await persistPhotoDimensions(prisma, vehicleId, path, manifest);
      } catch {
        throw new PhotoUploadError(
          502,
          'Não foi possível preparar os tamanhos da fotografia. Tente guardar novamente.',
        );
      }

      await finishPhotoUpload(path, uploadLease.token);
      if (staged) {
        const current = await prisma.vehicle.findUnique({
          where: { id: vehicleId },
          select: { id: true },
        });
        if (!current)
          throw new PhotoMutationError(
            409,
            'O rascunho foi eliminado entretanto. A fotografia não foi associada.',
          );

        completed = true;
        res
          .status(201)
          .json({ path, staged: true, bytes: photo.buffer.length, optimized: photo.optimized });
        return;
      }
      const result = await mutateVehiclePhotos(prisma, vehicleId, { type: 'append', path });
      completed = true;
      res.status(201).json({
        photos: result.photos,
        path,
        bytes: photo.buffer.length,
        optimized: photo.optimized,
      });
    } catch (error) {
      if (error instanceof PhotoUploadError || error instanceof PhotoLifecycleError) {
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
      clearInterval(leaseTimer);
      req.off('aborted', aborted);
      res.off('close', closed);
      await encoding?.close();
      if (uploadLease && !completed) {
        try {
          if (preserveExistingUpload) await finishPhotoUpload(uploadLease.path, uploadLease.token);
          else await failPhotoUpload(uploadLease.path, uploadLease.token);
        } catch {
          logger.error('Photo upload lease remains pending; cleanup will retry after expiry');
        }
      }
      if (storedPath) {
        try {
          await cleanupLateVehicleUpload(param(req, 'vehicleId'), storedPath);
        } catch {
          logger.error('Late vehicle upload cleanup unavailable; retry required');
        }
      }
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

    const cleaned = await processPhotoJob(photoPath);
    res.json({ ok: true, cleanupPending: !cleaned });
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
  if (
    (error instanceof PhotoMutationError || error instanceof PhotoLifecycleError) &&
    !res.headersSent
  ) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  next(error);
});

export default router;
