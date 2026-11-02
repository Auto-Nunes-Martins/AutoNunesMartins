import { json, type RequestHandler } from '@sveltejs/kit';
import { apiFetch } from '$lib/server/api';

const relay: RequestHandler = async (event) => {
  const path = event.params.path ?? '';
  if (!/^(?:[a-zA-Z0-9_-]{1,100}(?:\/avatar)?)?$/.test(path))
    return json({ error: 'Pedido inválido.' }, { status: 400 });
  const method = event.request.method;
  if (
    (method === 'POST' && path) ||
    (['PUT', 'DELETE'].includes(method) && !path) ||
    (method === 'GET' && path)
  )
    return json({ error: 'Pedido inválido.' }, { status: 400 });
  try {
    const response = await apiFetch(event, '/api/reviews' + (path ? '/' + path : ''), {
      method,
      ...(method === 'POST' || method === 'PUT'
        ? { body: event.request.body, duplex: 'half' as const }
        : {}),
      headers: { 'content-type': event.request.headers.get('content-type') ?? 'application/json' },
    });
    return new Response(response.body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return json(
      { error: 'Não foi possível contactar o servidor. A review mantém-se no editor.' },
      { status: 503 },
    );
  }
};
export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const DELETE = relay;
