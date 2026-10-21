import { publicRequest } from '$lib/server/publicVehicles';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';
import { createHash } from 'node:crypto';
export const GET: RequestHandler = async ({ params, request }) => {
  const headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex',
  };
  if (params.slug.length > 180 || !slugPattern.test(params.slug))
    return new Response(null, { status: 404, headers });
  try {
    const response = await publicRequest(`/unavailable/${params.slug}/photo`);
    if (!response.ok)
      return new Response(null, { status: response.status === 404 ? 404 : 503, headers });
    if (
      response.headers.get('content-type')?.split(';')[0] !== 'image/webp' &&
      response.headers.get('content-type')?.split(';')[0] !== 'image/jpeg' &&
      response.headers.get('content-type')?.split(';')[0] !== 'image/png'
    )
      return new Response(null, { status: 503, headers });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2_000_000) return new Response(null, { status: 503, headers });
    const etag = `"${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}"`;
    const photoHeaders = {
      ...headers,
      'cache-control': 'private, no-cache, max-age=0, must-revalidate',
      etag,
      'content-type': response.headers.get('content-type')!,
    };
    const unchanged = request.headers
      .get('if-none-match')
      ?.split(',')
      .some((value) => {
        const tag = value.trim().replace(/^W\//, '');
        return tag === '*' || tag === etag;
      });
    return unchanged
      ? new Response(null, { status: 304, headers: photoHeaders })
      : new Response(bytes, { headers: photoHeaders });
  } catch {
    return new Response(null, { status: 503, headers });
  }
};
