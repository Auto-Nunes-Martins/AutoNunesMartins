import { env } from '$env/dynamic/private';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
import { json } from '@sveltejs/kit';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
  const headers = { 'Cache-Control': 'no-store' };
  // Relay credentials are technical configuration; the backend controls whether sending is enabled.
  if (!env.CONTACT_RELAY_SECRET) {
    return json(
      { error: 'O envio de pedidos ainda não está disponível.' },
      { status: 503, headers },
    );
  }
  if (request.headers.get('origin') !== url.origin)
    return json({ error: 'Origem inválida.' }, { status: 403, headers });
  let clientAddress: string;
  try {
    clientAddress = getClientAddress();
  } catch {
    return json(
      { error: 'O envio de pedidos ainda não está disponível.' },
      { status: 503, headers },
    );
  }
  if (!isIP(clientAddress))
    return json(
      { error: 'O envio de pedidos ainda não está disponível.' },
      { status: 503, headers },
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Formato inválido.' }, { status: 415, headers });
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Pedido inválido.' }, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16_384) {
      await reader.cancel();
      return json({ error: 'Pedido demasiado longo.' }, { status: 413, headers });
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  try {
    JSON.parse(body);
  } catch {
    return json({ error: 'Pedido inválido.' }, { status: 400, headers });
  }
  try {
    const response = await fetch(
      new URL('/api/public/contact', env.INTERNAL_BACKEND_URL || PUBLIC_BACKEND_URL),
      {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-contact-relay': env.CONTACT_RELAY_SECRET,
          'x-contact-client': createHmac('sha256', env.CONTACT_RELAY_SECRET)
            .update(clientAddress)
            .digest('hex'),
        },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
        credentials: 'omit',
      },
    );
    const data = await response.json();
    return json(
      response.ok && data.ok === true
        ? { ok: true }
        : {
            error:
              typeof data.error === 'string' ? data.error : 'Não foi possível enviar o pedido.',
          },
      { status: response.ok && data.ok !== true ? 502 : response.status, headers },
    );
  } catch {
    return json(
      { error: 'Não foi possível confirmar o envio. Tente novamente dentro de alguns instantes.' },
      { status: 502, headers },
    );
  }
};
