import { apiFetch } from '$lib/server/api';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async (event) => {
  if (Number(event.request.headers.get('content-length') ?? 0) > 1024)
    return new Response(null, { status: 413 });
  const reader = event.request.body?.getReader(),
    decoder = new TextDecoder();
  let body = '',
    size = 0;
  if (reader)
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1024) {
          await reader.cancel();
          return new Response(null, { status: 413 });
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  const response = await apiFetch(event, `/api/vehicles/${event.params.id}/photos/diagnostics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return new Response(null, { status: response.status });
};
