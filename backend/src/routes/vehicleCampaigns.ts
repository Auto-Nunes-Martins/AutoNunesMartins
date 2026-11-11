import { Router } from 'express';
import { prisma } from '../db.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { campaignInput } from '../lib/data/campaignPricing.js';
import {
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
router.put(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = campaignInput.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({
          error:
            'Escolha até quatro viaturas distintas e preencha preços, referência documental e duração.',
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
