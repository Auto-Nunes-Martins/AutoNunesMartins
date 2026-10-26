import { asyncHandler } from '../middleware/asyncHandler.js';
import { Router, type Response } from 'express';
import { prisma } from '../db.js';
import { cache } from '../lib/data/cache.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';

import { userLifecycleAvailable } from '../lib/server/userLifecycleSchema.js';

const router = Router();

const USERS_TTL_MS = 60_000;
const USERS_CACHE_KEY = 'users:list';

/** List users that can be assigned to tasks. Only active profiles after the lifecycle migration (single role ADMIN). */
router.get(
  '/',
  requireUser,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const ready = await userLifecycleAvailable();
    const items = await cache.wrap(USERS_CACHE_KEY, USERS_TTL_MS, () =>
      prisma.user.findMany({
        where: ready ? { deactivatedAt: null } : {},
        select: { id: true, name: true, email: true, role: true, imageUrl: true },
        orderBy: { name: 'asc' },
      }),
    );
    res.set('Cache-Control', 'private, no-store');
    res.json({ items });
  }),
);

/** Call from the Clerk webhook handler after creating/updating a user row. */
export function invalidateUsersCache(): void {
  cache.invalidate(USERS_CACHE_KEY);
}

export default router;
