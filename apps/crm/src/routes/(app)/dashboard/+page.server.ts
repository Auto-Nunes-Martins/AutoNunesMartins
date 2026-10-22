import type { PageServerLoad } from './$types';
import { rethrowAuthError } from '$lib/server/api';
import {
  dashboardApi,
  type DashboardPayload,
  type DashboardHighlight,
} from '$lib/server/dashboard';
export type DashboardStream =
  | { kind: 'ok'; payload: DashboardPayload }
  | { kind: 'error'; message: string };
export const load: PageServerLoad = async (event) => {
  event.depends?.('crm:overview');
  const dashboard: Promise<DashboardStream> = dashboardApi
    .get(event)
    .then((payload): DashboardStream => ({ kind: 'ok', payload }))
    .catch((err): DashboardStream => ({ kind: 'error', message: (err as Error).message }));
  const highlights = await dashboardApi
    .highlights(event)
    .then(result => result.items)
    .catch(err => { rethrowAuthError(err); return [] as DashboardHighlight[]; });
  // Await the showcase so its photo and dimensions are present in the first HTML.
  return { dashboard, highlights };
};
