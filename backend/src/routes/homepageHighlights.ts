import { Router } from 'express';
import { prisma } from '../db.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  HighlightsError,
  highlightsInputSchema,
  readHighlightsEditor,
  readDashboardHighlights,
  saveHighlights,
} from '../lib/server/homepageHighlights.js';

const router = Router();
router.use(requireUser);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get(
  '/showcase',
  asyncHandler(async (_req, res) => {
    res.json(await readDashboardHighlights(prisma));
  }),
);
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await readHighlightsEditor(prisma));
  }),
);
router.put(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = highlightsInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Seleção inválida. Escolha até cinco viaturas diferentes.' });
      return;
    }
    try {
      res.json(await saveHighlights(prisma, parsed.data, req.user.id));
    } catch (error) {
      if (error instanceof HighlightsError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);
export default router;
