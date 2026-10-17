import { duplicateVehicleFeedback } from '../lib/domain/vehicleConflict.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { VehicleStateConflict } from '../lib/server/vehicleService.js';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { vehicleCreateSchema, vehicleFilterSchema, vehicleUpdateSchema } from '@anm/types';
import { vehiclePrincipalPath } from '../../../shared/vehiclePhotoPrincipal.mjs';
import { prisma } from '../db.js';
import { listVehicles } from '../lib/data/vehicle.js';
import { createSignedReadUrls } from '../lib/data/storage.js';
import { logger } from '../logger.js';
import {
  VehicleHasSale,
  VehicleNotDraft,
  VehicleNotFound,
  createVehicle,
  deleteVehicle,
  getVehicleWithProfit,
  publishVehicle,
  updateVehicle,
} from '../lib/server/vehicleService.js';
import { moneySchema } from '@anm/types';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { param } from '../lib/http.js';
import { saveVehicleEdit, vehicleEditSchema } from '../lib/server/vehicleEditService.js';
import { WebPublicationError } from '../lib/server/webPublicationService.js';
import { deleteObjects } from '../lib/data/storage.js';

const router = Router();

router.put('/:id/edit', requireUser, asyncHandler(async (req: AuthedRequest, res: Response) => {
  res.set('Cache-Control', 'no-store');
  if (!req.user || req.user.role !== 'ADMIN') { res.status(403).json({ error: 'Forbidden' }); return; }
  const parsed = vehicleEditSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Reveja os dados da viatura e da publicação.', issues: parsed.error.issues }); return; }
  try {
    const result = await saveVehicleEdit(param(req, 'id'), parsed.data, { actorId: req.user.id, actorName: req.user.name });
    // Database references and public approval have already been revoked atomically.
    if (result.removedPhotos.length) try { await deleteObjects(result.removedPhotos); }
    catch { logger.error('Unreferenced photo cleanup failed after vehicle edit'); }
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof VehicleNotFound) { res.status(404).json({ error: 'Viatura não encontrada.' }); return; }
    if (error instanceof VehicleStateConflict || error instanceof WebPublicationError) { res.status(error.status).json({ error: error.message, ...(error.field ? {issues:[{path:error.field.split('.'),message:error.message}]} : {}) }); return; }
    if ((error as { code?: string }).code === 'P2002') { res.status(409).json(duplicateVehicleFeedback(error)); return; }
    throw error;
  }
}));

const listQuerySchema = vehicleFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum(['createdAt', 'acquisitionDate', 'salePrice', 'purchasePrice', 'mileage', 'year'])
    .default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

router.get(
  '/',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', issues: parsed.error.issues });
      return;
    }
    const result = await listVehicles(prisma, parsed.data);

    // Batch-sign primary photos (index 0) so the list can show thumbnails.
    // A single Supabase call handles all rows on the current page.
    const primaryPaths = result.items
      .map(vehiclePrincipalPath)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);

    let signed: Map<string, string> = new Map();
    if (primaryPaths.length > 0) {
      try {
        signed = await createSignedReadUrls(primaryPaths, 3600, 320);
      } catch (err) {
        logger.warn({ err }, 'Failed to batch-sign vehicle thumbnails (list still works)');
      }
    }

    const originalUrls=await createSignedReadUrls(primaryPaths).catch(()=>new Map<string,string>());
    res.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15');
    res.json({
      ...result,
      items: result.items.map((v) => {
        const primary = vehiclePrincipalPath(v);
        return {
          ...v,
          purchasePrice: v.purchasePrice.toString(),
          salePrice: v.salePrice?.toString() ?? null,
          thumbnailUrl: primary ? (signed.get(primary) ?? null) : null,
          thumbnailOriginalUrl: primary ? (originalUrls.get(primary) ?? null) : null,
        };
      }),
    });
  }),
);

router.get(
  '/:id',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await getVehicleWithProfit(param(req, 'id'));
    if (!result) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    res.json(result);
  }),
);

router.post(
  '/',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = vehicleCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const created = await createVehicle(parsed.data, {
        actorId: req.user.id,
        actorName: req.user.name,
      });
      res.status(201).json({ id: created.id });
    } catch (err) {
      if (err instanceof VehicleStateConflict) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if ((err as { code?: string }).code === 'P2002') {
        res.status(409).json(duplicateVehicleFeedback(err));
        return;
      }
      throw err;
    }
  }),
);

router.patch(
  '/:id',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = vehicleUpdateSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await updateVehicle(param(req, 'id'), parsed.data, {
        actorId: req.user.id,
        actorName: req.user.name,
      });
      res.json({ ok: true });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        res.status(409).json(duplicateVehicleFeedback(err));
        return;
      }
      if ((err as { code?: string }).code === 'P2004') {
        res.status(409).json({
          error:
            'A retoma devolvida está fora do stock. Regularize uma nova aquisição separadamente antes de a disponibilizar.',
        });
        return;
      }
      if (err instanceof VehicleStateConflict) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if (err instanceof VehicleNotFound) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      throw err;
    }
  }),
);

const publishSchema = z.object({
  salePrice: moneySchema,
  // Descrição obrigatória na publicação (decisão do utilizador). O input
  // tem max 2000 chars como no /editar para manter o contrato consistente.
  description: z.string().trim().min(1, 'Descrição obrigatória').max(2000),
});

router.post(
  '/:id/publish',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await publishVehicle(
        param(req, 'id'),
        { salePrice: parsed.data.salePrice, description: parsed.data.description },
        { actorId: req.user.id, actorName: req.user.name },
      );
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof VehicleNotFound) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      if (err instanceof VehicleNotDraft) {
        res.status(409).json({
          error: `Viatura em estado "${err.currentStatus}" não pode ser publicada (só DRAFT).`,
        });
        return;
      }
      throw err;
    }
  }),
);

router.delete(
  '/:id',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await deleteVehicle(param(req, 'id'), {
        actorId: req.user.id,
        actorName: req.user.name,
      });
      res.json({ ok: true });
    } catch (err) {
      if (['P2003', 'P2014'].includes((err as { code?: string }).code ?? '')) {
        res.status(409).json({
          error: 'Esta viatura tem histórico de vendas ou retoma associado e deve ser preservada.',
        });
        return;
      }
      if (err instanceof VehicleNotFound) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      if (err instanceof VehicleHasSale) {
        res.status(409).json({
          error:
            'Esta viatura tem uma venda activa. Use o fluxo Anular venda para preservar o histórico.',
        });
        return;
      }
      throw err;
    }
  }),
);

export default router;
