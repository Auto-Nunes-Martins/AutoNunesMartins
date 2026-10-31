import { asyncHandler } from '../middleware/asyncHandler.js';
import { PhotoEncodingSession } from '../lib/server/photoEncodingSession.js';
import { ensurePhotoVariants } from '../lib/server/photoVariants.js';
import { persistPhotoDimensions, removePhotoDimensions } from '../lib/data/photoDimensions.js';
import { logger } from '../logger.js';
import { getProcessDiagnostics, clientMetrics } from '../../../shared/runtimeDiagnostics.mjs';
import { sanitizePhotoMetadata } from '../lib/server/photoMetadata.js';
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
import { photoFramingSchema, galleryFramingSchema } from '@anm/types';
import { lockVehicle } from '../lib/server/saleFinancials.js';
import { cache } from '../lib/data/cache.js';
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
const diagnostics=getProcessDiagnostics();
const transferSchema=z.object({trace:z.string().uuid(),transferMs:z.number().finite().min(0).max(300000),status:z.number().int().min(100).max(599).optional(),outcome:z.enum(['ok','error','network_error'])}).strict();
router.post('/diagnostics',requireUser,(req,res)=>{
  if(!diagnostics.enabled){res.status(204).end();return;}
  if(Number(req.get('content-length')??0)>1024||Buffer.byteLength(JSON.stringify(req.body??{}))>1024){res.status(413).end();return;}
  const parsed=transferSchema.safeParse(req.body);
  if(!parsed.success){res.status(400).end();return;}
  const {trace,outcome,...metrics}=parsed.data;
  res.status(diagnostics.clientTransfer(trace,metrics,outcome)?204:429).end();
});
const framingInput = z.object({ path: z.string().min(1).max(160), framing: photoFramingSchema.nullable() }).strict();
router.post('/framing', requireUser, asyncHandler(async (req: AuthedRequest, res: Response) => {
  const parsed = framingInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enquadramento inválido.', issues: parsed.error.issues }); return; }
  const id = param(req, 'vehicleId');
  const result = await prisma.$transaction(async tx => {
    await lockVehicle(tx, id);
    const vehicle = await tx.vehicle.findUnique({ where: { id }, select: { photos: true, galleryFraming: true } });
    if (!vehicle || !vehicle.photos.includes(parsed.data.path)) return null;
    const framing = galleryFramingSchema.parse(vehicle.galleryFraming);
    if (parsed.data.framing) framing[parsed.data.path] = parsed.data.framing;
    else delete framing[parsed.data.path];
    const cleaned = Object.fromEntries(Object.entries(framing).filter(([path]) => vehicle.photos.includes(path)));
    await tx.vehicle.update({ where: { id }, data: { galleryFraming: cleaned } });
    return cleaned;
  });
  if (!result) { res.status(404).json({ error: 'Fotografia não encontrada.' }); return; }
  cache.clearPrefix('dashboard:');
  res.json({ galleryFraming: result });
}));

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
    diagnostics.rejection();
    res.setHeader('Retry-After', '3');
    res.status(429).json({ error: 'Outra fotografia está a ser processada. Tente novamente.' });
    return;
  }
  const trace=diagnostics.begin(req.get('x-photo-trace-id'),clientMetrics(req.get('x-photo-metrics')));
  let outcome:'ok'|'error'|'aborted'='error', diagnosticStatus=500;
  let disconnected = false;
  let encoding: PhotoEncodingSession | undefined;
  const aborted = () => {
    disconnected = true;
    encoding?.abort();
  };
  const closed = () => {
    if (!res.writableEnded) aborted();
  };
  req.once('aborted', aborted);
  res.once('close', closed);
  if (diagnostics.enabled) {
    if (trace.id) res.set('x-photo-trace-id', trace.id);
    res.set('x-photo-diagnostics-enabled', 'true');
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
        outcome='ok';diagnosticStatus=201;
        req.resume();
        res.status(201).json({ photos: vehicle.photos, path: repeated, reused: true });
        return;
      }
      if (!staged && vehicle.photos.length >= MAX_PHOTOS)
        throw new PhotoMutationError(400, 'Máximo de 20 fotos por viatura.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.headers['content-type'] || ''))
        throw new PhotoUploadError(415, 'Formato inválido.');
      // Admission happens BEFORE reading any body. One buffer globally, queue length zero.
      trace.phase('receive');
      await new Promise<void>((resolve, reject) =>
        express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES, inflate: false })(
          req,
          res,
          (error) => (error ? reject(error) : resolve()),
        ),
      );
      if (!Buffer.isBuffer(req.body)) throw new PhotoUploadError(400, 'Ficheiro inválido.');
      trace.fields({inputBytes:req.body.length});trace.phase('optimize');
      // Production isolates all large pixel decoding/encoding. Explicit inline mode
      // remains available as a bounded rollback; tests/development keep their existing mode.
      if (process.env.NODE_ENV === 'production' && process.env.PHOTO_PROCESSING_MODE !== 'inline')
        encoding = new PhotoEncodingSession(trace);
      const photo = encoding
        ? await encoding.optimize(req.body as Buffer)
        : diagnostics.enabled
          ? await optimizePhoto(req.body as Buffer, trace)
          : await optimizePhoto(req.body as Buffer);
      req.body = undefined;
      trace.fields({outputBytes:photo.buffer.length});
      if (photo.buffer.length > MAX_OUTPUT_BYTES)
        throw new PhotoUploadError(422, 'A fotografia otimizada excede o limite de 2 MB.');
      const path = vehicleId + '/' + (uploadId ?? randomUUID()) + '.' + photo.extension;
      let storedMaster = photo.buffer;
      trace.phase('storage');
      const { error } = await getSupabase()
        .storage.from(getBucketName())
        .upload(path, photo.buffer, { contentType: photo.contentType, upsert: false });
      if (error && uploadId) {
        // A retry can reuse this exact immutable private object, without associating it.
        const previous = await getSupabase().storage.from(getBucketName()).download(path);
        if (previous.error || !previous.data || previous.data.size > MAX_OUTPUT_BYTES)
          throw new PhotoUploadError(502, 'Não foi possível preparar a fotografia.');
        storedMaster = Buffer.from(await previous.data.arrayBuffer());
        // A staged upload created before metadata filtering may be retried after deploy.
        // Compare the cleaned representation, but keep its immutable stored identity/hash.
        if (createHash('sha256').update(await sanitizePhotoMetadata(storedMaster)).digest('hex') !== createHash('sha256').update(photo.buffer).digest('hex'))
          throw new PhotoUploadError(502, 'Não foi possível preparar a fotografia.');
      } else if (error) throw new PhotoUploadError(502, 'Não foi possível guardar a fotografia.');
      try {
        trace.phase('derivatives');
        const { manifest } = encoding
          ? await ensurePhotoVariants(path, storedMaster, trace, async (input) => {
              try {
                return await encoding!.variants(input);
              } finally {
                await encoding!.close();
              }
            })
          : diagnostics.enabled
            ? await ensurePhotoVariants(path, storedMaster, trace)
            : await ensurePhotoVariants(path, storedMaster);
        await encoding?.close();
        trace.fields({width:manifest.width,height:manifest.height,outputWidth:manifest.width,outputHeight:manifest.height,variants:manifest.variants?.length??0});trace.phase('dimensions');
        await persistPhotoDimensions(prisma, vehicleId, path, manifest);
      }
      catch { throw new PhotoUploadError(502,'Não foi possível preparar os tamanhos da fotografia. Tente guardar novamente.'); }
      trace.phase('finalize');
      if (staged) {
        outcome='ok';diagnosticStatus=201;
        res.status(201).json({ path, staged: true, bytes: photo.buffer.length, optimized: photo.optimized });
        return;
      }
      try {
        const result = await mutateVehiclePhotos(prisma, vehicleId, { type: 'append', path });
        outcome='ok';diagnosticStatus=201;
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
          if (!current?.photos.includes(path)) {
            await deleteObjects([path]);
            await removePhotoDimensions(prisma, [path]);
          }
        } catch {
          /* orphan cleanup is preferable to deleting a referenced photo */
        }
        throw error;
      }
    } catch (error) {
      diagnosticStatus=typeof error==='object'&&error&&'status' in error&&typeof error.status==='number'?error.status:500;
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
      req.off('aborted', aborted);
      res.off('close', closed);
      await encoding?.close();
      trace.finish(disconnected?'aborted':outcome,{status:diagnosticStatus});
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

    try { await removePhotoDimensions(prisma, [photoPath]); }
    catch { logger.error('Unreferenced photo dimensions cleanup failed'); }

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
