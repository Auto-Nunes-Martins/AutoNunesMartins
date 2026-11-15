import { socialImageResponse } from '$lib/server/socialImages';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url, request }) => {
  const version = url.searchParams.get('v');
  if (!slugPattern.test(params.slug) || params.slug.length > 180)
    return new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } });
  if (
    !version ||
    !/^[a-f0-9]{64}$/.test(version) ||
    [...url.searchParams].some(([key]) => key !== 'v') ||
    url.searchParams.getAll('v').length !== 1
  )
    return new Response(null, { status: 400, headers: { 'cache-control': 'no-store' } });
  return socialImageResponse(`/${params.slug}/social-image?v=${version}`, request, version);
};
