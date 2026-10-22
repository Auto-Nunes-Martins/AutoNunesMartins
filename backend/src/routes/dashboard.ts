import { asyncHandler } from '../middleware/asyncHandler.js';
import { Router, type Response } from 'express';
import { cache } from '../lib/data/cache.js';
import { loadDashboard, loadTodayTasks, type DashboardPayload } from '../lib/server/dashboardService.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';

const router = Router();

// Dashboard values move on the scale of minutes/hours, and any mutation
// (sale, expense, vehicle status change) invalidates this cache via
// `cache.clearPrefix('dashboard:')` inside emitActivity. So we can afford
// a generous TTL — 90s keeps tab-switching genuinely instant.
const DASHBOARD_TTL_MS = 90_000;

router.get(
  '/',
  requireUser,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const actorId = req.user.id;
    const key = `dashboard:${actorId}`;
    const cached = cache.get<DashboardPayload>(key);
    // Keep aggregate caching, but always read the actionable task list fresh.
    const payload = cached
      ? { ...cached, todayTasks: await loadTodayTasks(actorId) }
      : await cache.wrap(key, DASHBOARD_TTL_MS, () => loadDashboard(actorId));
    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  }),
);

export default router;
