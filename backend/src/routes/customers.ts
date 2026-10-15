import { asyncHandler } from '../middleware/asyncHandler.js';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { customerCreateSchema, customerUpdateSchema } from '@anm/types';
import { prisma } from '../db.js';
import { listCustomers } from '../lib/data/customer.js';
import {
  CustomerHasSales,
  CustomerNotFound,
  DuplicateNif,
  createCustomer,
  deleteCustomer,
  getCustomerForDetail,
  updateCustomer,
} from '../lib/server/customerService.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { param } from '../lib/http.js';

const router = Router();

const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(25),
  sortBy: z.enum(['name', 'createdAt', 'lastContactDate']).default('createdAt'),
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
    const result = await listCustomers(prisma, parsed.data);
    res.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=15');
    res.json(result);
  }),
);

router.get(
  '/:id',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const result = await getCustomerForDetail(param(req, 'id'));
    if (!result) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json(result);
  }),
);

router.post(
  '/',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const created = await createCustomer(parsed.data, {
        actorId: req.user.id,
        actorName: req.user.name,
      });
      res.status(201).json({ id: created.id });
    } catch (err) {
      if (err instanceof DuplicateNif) {
        res.status(409).json({ error: `NIF ${err.nif} já existe.`, field: 'nif' });
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
    const parsed = customerUpdateSchema.omit({ id: true }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', issues: parsed.error.issues });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await updateCustomer(param(req, 'id'), parsed.data, {
        actorId: req.user.id,
        actorName: req.user.name,
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof CustomerNotFound) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      if (err instanceof DuplicateNif) {
        res.status(409).json({ error: `NIF ${err.nif} já existe.`, field: 'nif' });
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
      await deleteCustomer(param(req, 'id'), {
        actorId: req.user.id,
        actorName: req.user.name,
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof CustomerNotFound) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      if (err instanceof CustomerHasSales) {
        res.status(409).json({
          error: 'Cliente tem histórico de vendas associado e deve ser preservado.',
        });
        return;
      }
      throw err;
    }
  }),
);

export default router;
