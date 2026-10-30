import { json, type RequestHandler } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';

export const POST: RequestHandler = async (event) => {
  const res = await apiFetch(event, `/api/vehicles/${event.params.id}/photos/framing`, {
    method: 'POST',
    body: await event.request.text(),
    headers: { 'content-type': 'application/json' },
  });
  return json(await res.json().catch(() => ({})), { status: res.status });
};
