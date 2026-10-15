import type { PageServerLoad } from './$types';
import {
  dashboardApi,
  type DashboardPayload,
  type DashboardHighlight,
} from '$lib/server/dashboard';
import { usersApi, type TaskAssignee } from '$lib/server/tasks';
export type DashboardStream =
  | { kind: 'ok'; payload: DashboardPayload }
  | { kind: 'error'; message: string };
export const load: PageServerLoad = async (event) => {
  const dashboard: Promise<DashboardStream> = dashboardApi
    .get(event)
    .then((payload): DashboardStream => ({ kind: 'ok', payload }))
    .catch((err): DashboardStream => ({ kind: 'error', message: (err as Error).message }));
  const [users, highlights] = await Promise.all([
    usersApi
      .list(event)
      .then((result) => result.items)
      .catch(() => [] as TaskAssignee[]),
    dashboardApi
      .highlights(event)
      .then((result) => result.items)
      .catch(() => [] as DashboardHighlight[]),
  ]);
  // Await the showcase so its photo and dimensions are present in the first HTML.
  return { dashboard, users, highlights };
};
