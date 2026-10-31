import { json, type RequestHandler } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';

export const POST: RequestHandler = async (event) => {
  const id = event.params.id ?? '';
  if (!/^contact:[a-f0-9]{64}$/.test(id)) {
    return json({ error: 'Invalid notification' }, { status: 400 });
  }
  const response = await apiFetch(
    event,
    '/api/notifications/contacts/' + encodeURIComponent(id) + '/read',
    { method: 'POST' },
  );
  return json(await response.json().catch(() => ({})), {
    status: response.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
};
