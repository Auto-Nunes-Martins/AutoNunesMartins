import type { PageLoad } from './$types';
import { vehiclesFilters } from '$lib/lists/listFilters';
import { loadListPage } from '$lib/lists/loadListPage';

export const load: PageLoad = async (event) => {
  event.depends('crm:overview');
  const identity = await event.parent();
  return loadListPage('vehicles', event, identity, vehiclesFilters(event.url));
};
