import { apiFetch } from '$lib/server/api';
import { json, type RequestHandler } from '@sveltejs/kit';
export const POST: RequestHandler = async (event) => {
  const contentLength = Number(event.request.headers.get('content-length') ?? 0);
  if (contentLength > 8192) return json({ error: 'Pedido demasiado grande.' }, { status: 413 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = event.request.body?.getReader();
  if (reader) {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          await reader.cancel();
          return json({ error: 'Pedido demasiado grande.' }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  const response = await apiFetch(
    event,
    '/api/vehicles/' + encodeURIComponent(event.params.id!) + '/photos/staging',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
};
