import { publicRequest } from './publicVehicles';

/** Same-origin crawler URL. Backend checks publication before using cached pixels. */
export async function socialImageResponse(path: string, request: Request, version?: string) {
  const fail = (status = 503) =>
    new Response(null, { status, headers: { 'cache-control': 'no-store' } });
  try {
    const response = await publicRequest(path, {
      accept: 'image/jpeg',
      ...(request.headers.has('if-none-match')
        ? { 'if-none-match': request.headers.get('if-none-match')! }
        : {}),
    });
    if (!response.ok && response.status !== 304) {
      await response.body?.cancel();
      return fail(response.status === 404 ? 404 : response.status === 400 ? 400 : 503);
    }
    if (version && response.headers.get('x-social-photo-version') !== version) {
      await response.body?.cancel();
      return fail();
    }
    const headers: Record<string, string> = {
      'cache-control': version ? 'public, max-age=0, must-revalidate' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-type': 'image/jpeg',
    };
    const etag = response.headers.get('etag');
    if (etag) headers.etag = etag;
    if (response.status === 304) return new Response(null, { status: 304, headers });
    if (response.headers.get('content-type')?.split(';')[0] !== 'image/jpeg') {
      await response.body?.cancel();
      return fail();
    }
    const reader = response.body?.getReader();
    if (!reader) return fail();
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 2_000_000) {
        await reader.cancel();
        return fail();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return fail();
    return new Response(bytes, { headers });
  } catch {
    return fail();
  }
}
