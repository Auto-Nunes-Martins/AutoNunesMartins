import type { PageLoad } from './$types';
import { salesFilters } from '$lib/listFilters';
import { loadListPage } from '$lib/lists/loadListPage';

export const load: PageLoad = async (event) => {
  event.depends('crm:overview');
  const identity = await event.parent();
  return loadListPage('sales', event, identity, salesFilters(event.url));
};
