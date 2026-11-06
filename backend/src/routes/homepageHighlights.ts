import { Router } from 'express';
import { prisma } from '../db.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { isApprovedPhotoPath } from '../lib/domain/publicVehicle.js';
import {
  HighlightsError,
  highlightsInputSchema,
  readHighlightsEditor,
  readDashboardHighlights,
  readHighlightPreviews,
  readHighlightGallery,
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
  '/photos',
  asyncHandler(async (req, res) => {
    const paths = typeof req.query.path === 'string' ? [req.query.path] : req.query.path;
    if (!Array.isArray(paths) || !paths.length || paths.length > 12 || !paths.every(
      (path): path is string => typeof path === 'string' && path.length <= 100 &&
        isApprovedPhotoPath(path.split('/')[0]!, path),
    )) {
      res.status(400).json({ error: 'Pedido de fotografias inválido.' });
      return;
    }
    res.json({ photos: await readHighlightPreviews(prisma, paths) });
  }),
);
router.get(
  '/photos/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const photos = typeof id === 'string' && /^c[a-z0-9]{24}$/.test(id)
      ? await readHighlightGallery(prisma, id)
      : null;
    if (!photos) {
      res.status(404).json({ error: 'Viatura sem fotografias elegíveis.' });
      return;
    }
    res.json({ photos });
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
