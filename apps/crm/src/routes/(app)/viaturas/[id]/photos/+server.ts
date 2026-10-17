import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { PUBLIC_BACKEND_URL } from '$env/static/public';
export const POST: RequestHandler = async (event) => {
  const token = await event.locals.auth().getToken();
  if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
  // Stream through the relay; global admission and byte/pixel limits live in Express.
  const response = await fetch(
    new URL(
      '/api/vehicles/' + event.params.id + '/photos',
      env.INTERNAL_BACKEND_URL || PUBLIC_BACKEND_URL,
    ),
    {
      method: 'POST',
      body: event.request.body,
      duplex: 'half',
      headers: {
        'content-type': event.request.headers.get('content-type') || '',
        authorization: 'Bearer ' + token,
        ...(event.request.headers.has('x-upload-id') ? { 'x-upload-id': event.request.headers.get('x-upload-id')! } : {}),
        ...(event.request.headers.get('x-edit-stage') === 'true' ? { 'x-edit-stage': 'true' } : {}),
      },
      signal: AbortSignal.timeout(180000),
    } as RequestInit & { duplex: string },
  );
  return json(await response.json().catch(() => ({})), {
    status: response.status,
    headers: response.headers.has('retry-after')
      ? { 'retry-after': response.headers.get('retry-after')! }
      : {},
  });
};
