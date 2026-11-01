import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiJson, ApiError } from '$lib/server/api';

export const DELETE: RequestHandler = async event => {
  try {
    const expected = event.request.headers.get('x-expected-updated-at');
    const result = await apiJson(event, `/api/vehicles/${encodeURIComponent(event.params.id)}/draft`, {
      method: 'DELETE', ...(expected ? { headers: { 'x-expected-updated-at': expected } } : {}),
    });
    return json(result, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    const body = error instanceof ApiError ? error.body as { error?: string } : null;
    return json({ error: body?.error ?? 'Não foi possível confirmar a eliminação. Atualize a lista antes de repetir.' },
      { status: error instanceof ApiError ? error.status : 503, headers: { 'cache-control': 'private, no-store' } });
  }
};
