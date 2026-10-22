import type { PageLoad } from './$types';
import { customersFilters } from '$lib/listFilters';
import { loadListPage } from '$lib/lists/loadListPage';

export const load: PageLoad = async (event) => {
  event.depends('crm:overview');
  const identity = await event.parent();
  return loadListPage('customers', event, identity, customersFilters(event.url));
};
