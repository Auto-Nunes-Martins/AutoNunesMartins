import { json } from '@sveltejs/kit';
import { customersApi } from '$lib/server/customers';
import type { RequestHandler } from './$types';

// The CRM server hook authenticates this endpoint; data never enters a shared cache.
export const GET: RequestHandler = async (event) => {
  const q = (event.url.searchParams.get('q') ?? '').trim();
  if (!q || q.length > 120) return json({ items: [], total: 0 });
  const result = await customersApi.list(event, {
    q,
    page: 1,
    pageSize: 50,
    sortBy: 'name',
    sortDir: 'asc',
  });
  return json({ items: result.items, total: result.total });
};
