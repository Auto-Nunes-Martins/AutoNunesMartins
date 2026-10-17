import { publicRequest } from '$lib/server/publicVehicles';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params, url, request }) => {
  const width=url.searchParams.get('w');
  const headers:Record<string,string> = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if(width!==null&&!['320','800','1600','2560'].includes(width))return new Response(null,{status:400,headers});
  if (
    !slugPattern.test(params.slug) ||
    params.slug.length > 180 ||
    !/^(?:[0-9]|1[0-9])$/.test(params.index)
  )
    return new Response(null, { status: 404, headers });
  try {
    const response = await publicRequest(`/${params.slug}/photos/${params.index}${width?'?w='+width:''}`,width&&request.headers.get('if-none-match')?{'if-none-match':request.headers.get('if-none-match')!}:{});
    if(width&&(response.ok||response.status===304)){
      headers['cache-control']='private, no-cache, max-age=0, must-revalidate';
      const etag=response.headers.get('etag');if(etag)headers.etag=etag;
      const version=response.headers.get('x-photo-version');if(version&&/^[a-f0-9]{64}$/.test(version))headers['x-photo-version']=version;
      if(response.status===304)return new Response(null,{status:304,headers});
    }
    if (!response.ok)
      return new Response(null, { status: response.status === 404 ? 404 : 503, headers });
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType))
      return new Response(null, { status: 503, headers });
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 20 * 1024 * 1024) return new Response(null, { status: 503, headers });
    return new Response(bytes, { headers: { ...headers, 'content-type': contentType } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
};
