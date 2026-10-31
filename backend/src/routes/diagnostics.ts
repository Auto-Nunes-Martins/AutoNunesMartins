import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { diagnosticStoreStatus } from '../lib/server/diagnosticStore.js';
import { diagnosticTransportStats } from '../../../shared/diagnosticEvents.mjs';
const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  next();
});
const query = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    instance: z.string().uuid().optional(),
    trace: z.string().uuid().optional(),
    service: z.enum(['backend', 'crm', 'website', 'gateway', 'supervisor']).optional(),
    after: z
      .string()
      .regex(/^\d{1,19}$/)
      .refine((value) => /^\d{1,19}$/.test(value) && BigInt(value) <= 9223372036854775807n)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
router.get(
  '/',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const parsed = query.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid diagnostic query' });
      return;
    }
    const q = parsed.data,
      to = new Date(q.to ?? Date.now()),
      from = new Date(q.from ?? to.getTime() - 3600000);
    if (from > to || to.getTime() - from.getTime() > 7 * 86400000) {
      res.status(400).json({ error: 'Maximum interval is 7 days' });
      return;
    }
    const where = [Prisma.sql`"occurredAt">=${from}`, Prisma.sql`"occurredAt"<=${to}`];
    if (q.instance) where.push(Prisma.sql`"instance"=${q.instance}::uuid`);
    if (q.trace) where.push(Prisma.sql`"trace"=${q.trace}::uuid`);
    if (q.service) where.push(Prisma.sql`"service"=${q.service}`);
    if (q.after) where.push(Prisma.sql`"id">${BigInt(q.after)}`);
    try {
      const rows = await prisma.$queryRaw<{ id: string; [key: string]: unknown }[]>(
        Prisma.sql`SELECT "id"::text,"occurredAt","receivedAt","instance"::text,"boot"::text,"service","event","kind","processSequence"::text,"trace"::text,"payload" FROM "RuntimeDiagnosticEvent" WHERE ${Prisma.join(where, ' AND ')} ORDER BY "id" ASC LIMIT ${q.limit + 1}`,
      );
      const more = rows.length > q.limit,
        events = rows.slice(0, q.limit);
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({
        events,
        next: more ? events.at(-1)?.id : null,
        order: 'receipt_sequence',
        from: from.toISOString(),
        to: to.toISOString(),
        store: {
          persistenceViaSupervisor: process.env.RUNTIME_DIAGNOSTICS_MANAGED === 'true',
          localWriter: diagnosticStoreStatus,
          transport: diagnosticTransportStats(),
        },
      });
    } catch {
      res.status(503).json({ error: 'Diagnostic history unavailable' });
    }
  }),
);
export default router;
