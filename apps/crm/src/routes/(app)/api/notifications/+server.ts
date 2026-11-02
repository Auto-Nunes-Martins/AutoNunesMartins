import { json, type RequestHandler } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';

export const GET: RequestHandler = async (event) => {
  const context = event.url.searchParams.get('activeCreationDraftId');
  const query = context ? '?activeCreationDraftId=' + encodeURIComponent(context) : '';
  const res = await apiFetch(event, '/api/notifications' + query, { method: 'GET' });
  return json(await res.json().catch(() => ({})), {
    status: res.status,
    headers: { 'cache-control': 'private, no-store' },
  });
};
