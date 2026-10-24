import { publicRequest } from '$lib/server/publicVehicles';
import { slugPattern } from '$lib/publicVehicles';
import type { RequestHandler } from './$types';
import { photoWidths } from '$lib/vehiclePhotoSources';
export const GET: RequestHandler = async ({ params, url, request }) => {
  const width = url.searchParams.get('w');
  const headers: Record<string, string> = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  };
  if (width !== null && !photoWidths.some((candidate) => String(candidate) === width))
    return new Response(null, { status: 400, headers });
  if (
    !slugPattern.test(params.slug) ||
    params.slug.length > 180 ||
    !/^(?:[0-9]|1[0-9])$/.test(params.index)
  )
    return new Response(null, { status: 404, headers });
  try {
    const response = await publicRequest(
      `/${params.slug}/photos/${params.index}${width ? '?w=' + width : ''}`,
      width && request.headers.get('if-none-match')
        ? { 'if-none-match': request.headers.get('if-none-match')! }
        : {},
    );
    // Numeric photo-stage diagnostics only; never forward arbitrary backend metadata.
    const timing = response.headers.get('server-timing');
    if (response.headers.get('x-photo-cache-policy') === 'shared-v1')
      headers['x-photo-cache-policy'] = 'shared-v1';
    if (
      timing &&
      timing.length <= 512 &&
      timing
        .split(', ')
        .every((entry) =>
          /^photo-(?:check|manifest|storage|total|cache-hit|cache-miss);dur=\d+(?:\.\d+)?$/.test(
            entry,
          ),
        )
    )
      headers['server-timing'] = timing;
    if (width && (response.ok || response.status === 304)) {
      headers['cache-control'] = 'private, no-cache, max-age=0, must-revalidate';
      const etag = response.headers.get('etag');
      if (etag) headers.etag = etag;
      const version = response.headers.get('x-photo-version');
      if (version && /^[a-f0-9]{64}$/.test(version)) headers['x-photo-version'] = version;
      if (response.status === 304) return new Response(null, { status: 304, headers });
    }
    if (!response.ok)
      return new Response(null, { status: response.status === 404 ? 404 : 503, headers });
    const contentType = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType))
      return new Response(null, { status: 503, headers });
    const length = response.headers.get('content-length');
    // The authorized backend sends a complete, bounded Buffer with Content-Length.
    // Forward its chunks without retaining a second full copy in the website.
    if (length && /^\d+$/.test(length) && !response.headers.get('content-encoding')) {
      const expected = Number(length);
      if (expected > 20 * 1024 * 1024 || !response.body) {
        await response.body?.cancel();
        return new Response(null, { status: 503, headers });
      }
      let received = 0;
      const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > expected) throw new Error('Photo length exceeded');
            controller.enqueue(chunk);
          },
          flush() {
            if (received !== expected) throw new Error('Incomplete photo');
          },
        }),
      );
      return new Response(body, {
        headers: {
          ...headers,
          'content-type': contentType,
          'content-length': length,
          'x-photo-delivery': 'stream-v1',
        },
      });
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 20 * 1024 * 1024) return new Response(null, { status: 503, headers });
    return new Response(bytes, { headers: { ...headers, 'content-type': contentType } });
  } catch {
    return new Response(null, { status: 503, headers });
  }
};
