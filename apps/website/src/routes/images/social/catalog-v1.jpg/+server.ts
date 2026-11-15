import { registeredBrandSchema } from '@anm/types';
import { socialImageResponse } from '$lib/server/socialImages';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, request }) => {
  const brand = url.searchParams.get('marca');
  const parsed = brand === null ? null : registeredBrandSchema.safeParse(brand);
  if (
    url.searchParams.getAll('marca').length > 1 ||
    [...url.searchParams].some(([key]) => key !== 'marca') ||
    (parsed && !parsed.success)
  )
    return new Response(null, { status: 400, headers: { 'cache-control': 'no-store' } });
  const query = parsed?.success ? `?${new URLSearchParams({ marca: parsed.data })}` : '';
  return socialImageResponse(`/social/catalog${query}`, request);
};
