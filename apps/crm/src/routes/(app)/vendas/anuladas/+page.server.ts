import { salesApi } from '$lib/server/sales';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
  list: await salesApi.list(event, {
    state: 'CANCELLED',
    page: Number(event.url.searchParams.get('page')) || 1,
  }),
});
