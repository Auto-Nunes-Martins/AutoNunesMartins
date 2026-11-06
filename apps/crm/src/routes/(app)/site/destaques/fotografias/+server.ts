import { json, type RequestHandler } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';

const headers = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async (event) => {
  const id = event.url.searchParams.get('viatura');
  const paths = event.url.searchParams.getAll('path');
  if (id !== null ? !/^c[a-z0-9]{24}$/.test(id) || paths.length > 0 :
    !paths.length || paths.length > 12 || paths.some((path) => path.length > 100)) {
    return json({ error: 'Pedido de fotografias inválido.' }, { status: 400, headers });
  }
  const endpoint = id
    ? `/api/homepage-highlights/photos/${id}`
    : '/api/homepage-highlights/photos?' + new URLSearchParams(paths.map((path) => ['path', path]));
  try {
    const response = await apiFetch(event, endpoint, { signal: AbortSignal.timeout(12_000) });
    return new Response(response.body, {
      status: response.status,
      headers: { ...headers, 'content-type': 'application/json' },
    });
  } catch {
    return json({ error: 'Não foi possível carregar as fotografias.' }, { status: 503, headers });
  }
};
