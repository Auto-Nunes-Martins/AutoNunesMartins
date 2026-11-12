import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { campaignAddition, campaignInput } from '../lib/data/campaignPricing.js';
import {
  addCampaign,
  CampaignConflict,
  readCampaignEditor,
  saveCampaigns,
} from '../lib/server/vehicleCampaigns.js';

const router = Router();
router.use(requireUser);
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await readCampaignEditor(prisma));
  }),
);
export function campaignAdditionHandler(db: PrismaClient) {
  return asyncHandler(async (req: AuthedRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
      res.status(req.user ? 403 : 401).json({ error: 'Acesso reservado a administradores.' });
      return;
    }
    const parsed = campaignAddition.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Indique uma única viatura, preço e duração para adicionar.' });
      return;
    }
    try {
      res.status(201).json(await addCampaign(db, parsed.data, req.user.id));
    } catch (error) {
      if (error instanceof CampaignConflict) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  });
}

router.post('/add', campaignAdditionHandler(prisma));
router.put(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = campaignInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
            'Escolha até quatro viaturas distintas e preencha o preço temporário e a duração.',
      });
      return;
    }
    try {
      res.json(await saveCampaigns(prisma, parsed.data, req.user.id));
    } catch (error) {
      if (error instanceof CampaignConflict) {
        res.status(409).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);
export default router;
