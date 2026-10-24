import { Transform } from 'node:stream';
import { isPublicPhotoVersion, REVALIDATE_PUBLIC_PHOTO } from '../shared/publicPhotoCache.mjs';

// Keep the existing public URL/cache identity. Only the photo GET/HEAD fast path
// is relayed; invalid routes, originals and all writes still reach SvelteKit.
export function photoBackendPath(method, url) {
  if (!['GET', 'HEAD'].includes(method)) return null;
  const [pathname, query = ''] = url.split('?');
  const match = /^\/viaturas\/([a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{12,64})\/photos\/(\d|1\d)$/.exec(pathname);
  if (!match || match[1].length > 180) return null;
  const params = new URLSearchParams(query), width = params.get('w'), version = params.get('v');
  if (![...params.keys()].every(key => key === 'w' || key === 'v') ||
    params.getAll('w').length !== 1 || params.getAll('v').length > 1 ||
    !/^(320|384|800|1280|1600|2560)$/.test(width || '') ||
    (version !== null && !isPublicPhotoVersion(version))) return null;
  return `/api/public/vehicles/${match[1]}/photos/${match[2]}?w=${width}${version ? '&v=' + version : ''}`;
}

export function relayPublicPhoto(req, res, reply, commonHeaders = {}) {
  const headers = {
    ...commonHeaders,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-photo-delivery': 'gateway-v2',
  };
  const reject = () => {
    reply.resume();
    res.writeHead(reply.statusCode === 404 ? 404 : 503, headers);
    res.end();
  };
  if (![200, 304].includes(reply.statusCode)) return reject();
  const requestedVersion = new URL(req.url, 'http://gateway.invalid').searchParams.get('v');
  if (requestedVersion && requestedVersion !== reply.headers['x-photo-version']) return reject();
  const type = reply.headers['content-type']?.split(';')[0];
  const length = reply.headers['content-length'];
  if (reply.statusCode === 200 && (
    !['image/jpeg', 'image/png', 'image/webp'].includes(type) ||
    !/^\d+$/.test(length || '') || Number(length) > 20 * 1024 * 1024 ||
    reply.headers['content-encoding']
  )) return reject();
  headers['cache-control'] = REVALIDATE_PUBLIC_PHOTO;
  if (reply.headers.etag) headers.etag = reply.headers.etag;
  if (/^[a-f0-9]{64}$/.test(reply.headers['x-photo-version'] || ''))
    headers['x-photo-version'] = reply.headers['x-photo-version'];
  if (reply.headers['x-photo-cache-policy'] === 'shared-v1')
    headers['x-photo-cache-policy'] = 'shared-v1';
  const timing = reply.headers['server-timing'];
  if (typeof timing === 'string' && timing.length <= 512 && timing.split(', ').every(entry =>
    /^photo-(?:check|manifest|storage|total|cache-hit|cache-miss);dur=\d+(?:\.\d+)?$/.test(entry)))
    headers['server-timing'] = timing;
  if (reply.statusCode === 304) {
    reply.resume();
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(200, { ...headers, 'content-type': type, 'content-length': length });
  if (req.method === 'HEAD') { reply.resume(); res.end(); return; }
  let bytes = 0;
  const bounded = new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > Number(length) ? new Error('Photo length exceeded') : null, chunk);
    },
    flush(done) { done(bytes !== Number(length) ? new Error('Incomplete photo') : null); },
  });
  const fail = () => { bounded.destroy(); reply.destroy(); res.destroy(); };
  reply.on('error', fail);
  bounded.on('error', fail);
  reply.pipe(bounded).pipe(res);
}
