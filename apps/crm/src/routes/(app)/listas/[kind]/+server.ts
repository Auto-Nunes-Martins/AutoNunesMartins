import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { load as vehicles } from '$lib/server/listPages/vehicles';
import { load as sales } from '$lib/server/listPages/sales';
import { load as customers } from '$lib/server/listPages/customers';

export const GET: RequestHandler = async event => {
  // hooks.server guards these relays; each backend read also checks the current user.
  const headers = { 'Cache-Control': 'private, no-store' };
  if (event.params.kind === 'vehicles') {
    const result = vehicles(event);
    const [list, drafts] = await Promise.all([result.list, result.drafts]);
    return json({ list, drafts }, { headers });
  }
  if (event.params.kind === 'sales') return json({ list: await sales(event).list }, { headers });
  if (event.params.kind === 'customers') return json({ list: await customers(event).list }, { headers });
  error(404);
};
