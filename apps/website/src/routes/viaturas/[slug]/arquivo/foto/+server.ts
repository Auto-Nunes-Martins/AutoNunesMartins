import { publicRequest } from '$lib/server/publicVehicles';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  const headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex',
  };
  if (params.slug.length > 180 || !slugPattern.test(params.slug))
    return new Response(null, { status: 404, headers });
  try {
    const response = await publicRequest(`/archive/${params.slug}/photo`);
    if (!response.ok)
      return new Response(null, { status: response.status === 404 ? 404 : 503, headers });
    if (response.headers.get('content-type')?.split(';')[0] !== 'image/webp')
      return new Response(null, { status: 503, headers });
    const bytes = await response.arrayBuffer();
    return bytes.byteLength <= 800_000
      ? new Response(bytes, { headers: { ...headers, 'content-type': 'image/webp' } })
      : new Response(null, { status: 503, headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
};
