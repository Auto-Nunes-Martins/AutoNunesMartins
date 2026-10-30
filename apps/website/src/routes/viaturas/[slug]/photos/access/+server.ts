import { publicRequest } from '$lib/server/publicVehicles';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params }) => {
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (!slugPattern.test(params.slug) || params.slug.length > 180)
    return new Response(null, { status: 404, headers });
  try {
    const response = await publicRequest(`/${params.slug}/photos/access`);
    if (!response.ok)
      return new Response(null, { status: response.status === 404 ? 404 : 503, headers });
    const data = await response.json();
    if (
      !Array.isArray(data.versions) ||
      data.versions.length > 20 ||
      !data.versions.every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))
    )
      return new Response(null, { status: 503, headers });
    const dimensions=data.photoDimensions;
    const valid=Array.isArray(dimensions)&&dimensions.length===data.versions.length&&dimensions.every((d,i)=>d===null||(d?.version===data.versions[i]&&Number.isInteger(d.width)&&Number.isInteger(d.height)&&d.width>0&&d.height>0&&d.width*d.height<=24_000_000));
    return Response.json({ versions: data.versions,...(valid?{photoDimensions:dimensions}:{}) }, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
};
