import { crmPath } from '$lib/paths';
import { redirect, error } from '@sveltejs/kit';
import { apiJson, ApiError, apiErrorMessage, rethrowAuthError } from '$lib/server/api';
import type { LayoutServerLoad } from './$types';

interface MeResponse {
  user: { id: string; clerkId: string; email: string; name: string; role: 'ADMIN' };
}

interface VehicleStatsResponse {
  active: number;
  available: number;
  reserved: number;
  docsPending: number;
  sold: number;
  delivered: number;
  total: number;
}

interface TaskStatsResponse {
  /** Tasks assigned to the current user OR unassigned ("general"), not DONE. */
  mineActive: number;
}

export const load: LayoutServerLoad = async (event) => {
  const { userId } = event.locals.auth();
  if (!userId) {
    throw redirect(302, crmPath('/'));
  }

  // These authenticated reads are independent; avoid an extra serial roundtrip.
  const optionalStats = <T>(path: string) => apiJson<T>(event, path).catch((err) => {
    rethrowAuthError(err);
    return null;
  });
  const [me, vehicleStats, taskStats] = await Promise.all([
    apiJson<MeResponse>(event, '/api/me').catch((err) => {
      const status = err instanceof ApiError && [401, 403].includes(err.status) ? err.status : 503;
      return error(status, apiErrorMessage(status));
    }),
    optionalStats<VehicleStatsResponse>('/api/vehicles/stats'),
    optionalStats<TaskStatsResponse>('/api/tasks/stats'),
  ]);
  return { clerkUserId: userId, currentUser: me.user, vehicleStats, taskStats };
};
