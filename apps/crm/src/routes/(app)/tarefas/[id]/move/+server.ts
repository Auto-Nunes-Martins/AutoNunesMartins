import { json, type RequestHandler } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';

export const PATCH: RequestHandler = async (event) => {
  const res = await apiFetch(event, `/api/tasks/${event.params.id}/move`, {
    method: 'PATCH',
    body: await event.request.text(),
    headers: { 'content-type': 'application/json' },
  });
  return json(await res.json().catch(() => ({})), { status: res.status });
};
