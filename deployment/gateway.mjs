import http from 'node:http';
import { selectRoute } from './routing.mjs';
import { immutableAssets } from './immutable-assets.mjs';
import { clientAddress, clientAddressHeader } from './client-address.mjs';
import { photoBackendPath, relayPublicPhoto } from './public-photo.mjs';

export function createGateway(settings, ports, ready = () => true, buildAssets = immutableAssets(settings.base)) {
  const server = http.createServer((req, res) => {
    const route = selectRoute(settings, req.headers.host, req.url);
    if (!route) {
      res.writeHead(421, { 'cache-control': 'no-store' });
      res.end();
      return;
    }
    const privateResponse = route.service !== 'website';
    const photoPath = route.service === 'website' ? photoBackendPath(req.method, req.url) : null;
    const headers = { 'x-content-type-options': 'nosniff' };
    if (privateResponse) {
      headers['cache-control'] = 'private, no-store';
      headers['x-robots-tag'] = 'noindex, nofollow';
    } else if (settings.noindex) headers['x-robots-tag'] = 'noindex, follow';
    if (route.service === 'health') {
      res.writeHead(ready() ? 200 : 503, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: ready() }));
      return;
    }
    if (!ready()) {
      res.writeHead(503, headers);
      res.end();
      return;
    }
    // Public backend projection and signed webhook keep their existing verification.
    // Private API access uses bearer tokens; browser sessions go via guarded CRM relays.
    if (
      route.service === 'backend' &&
      !req.url.startsWith('/api/public/') &&
      req.url !== '/webhooks/clerk' &&
      !/^Bearer \S+$/.test(req.headers.authorization || '')
    ) {
      res.writeHead(401, headers);
      res.end();
      return;
    }
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (unsafe && req.url !== '/webhooks/clerk' && req.headers.origin !== route.origin) {
      res.writeHead(403, headers);
      res.end();
      return;
    }
    const address = route.service === 'website'
      ? clientAddress(req, settings.clientAddressSource) : null;
    if (route.service === 'website' && req.method === 'POST' &&
        /^\/api\/contact\/?(?:\?|$)/.test(req.url) && !address) {
      res.writeHead(503, { ...headers, 'cache-control': 'no-store', 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'O envio de pedidos ainda não está disponível.' }));
      return;
    }
    // Recreate trusted proxy headers. Never consume incoming forwarded host/proto.
    const forwarded = { ...req.headers, host: new URL(route.origin).host };
    for (const key of Object.keys(forwarded)) {
      if (
        key.startsWith('x-forwarded-') ||
        [
          'forwarded',
          'connection',
          'transfer-encoding',
          'upgrade',
          'proxy-authorization',
          'proxy-connection',
          clientAddressHeader,
        ].includes(key)
      )
        delete forwarded[key];
    }
    forwarded['x-forwarded-proto'] = new URL(route.origin).protocol.slice(0, -1);
    if (route.service === 'website' && address) forwarded[clientAddressHeader] = address;
    // Match the website's anonymous photo relay: never forward visitor cookies
    // or CRM credentials to this public read-only projection.
    const photoHeaders = { accept: 'image/webp,image/*', host: new URL(route.origin).host };
    if (req.headers['if-none-match']) photoHeaders['if-none-match'] = req.headers['if-none-match'];
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: ports[photoPath ? 'backend' : route.service],
        path: photoPath || req.url,
        method: req.method,
        headers: photoPath ? photoHeaders : forwarded,
      },
      (reply) => {
        if (photoPath) { relayPublicPhoto(req, res, reply, headers); return; }
        // Only adapter-confirmed build assets are public. Never infer cacheability
        // from a file extension (private routes can have one too).
        const immutablePrefix = `${route.service === 'crm' ? settings.base : ''}/_app/immutable/`;
        const pathname = req.url.split('?')[0];
        // mrmime 2.0.1 (bundled by the adapter) omits ICO. Supply its standard
        // MIME only for registered build files, never guessed dynamic routes.
        if (['website', 'crm'].includes(route.service) &&
          ['GET', 'HEAD'].includes(req.method) && reply.statusCode === 200 &&
          buildAssets.has(pathname) && pathname.endsWith('.ico') &&
          (pathname.startsWith(immutablePrefix) || (route.service === 'website' && pathname === '/favicon.ico')) &&
          !reply.headers['content-type'] && !reply.headers['set-cookie']) {
          reply.headers['content-type'] = 'image/x-icon';
        }
        const immutable = ['website', 'crm'].includes(route.service) &&
          ['GET', 'HEAD'].includes(req.method) &&
          req.url.split('?')[0].startsWith(immutablePrefix) &&
          buildAssets.has(req.url.split('?')[0]) &&
          ((reply.statusCode === 200 &&
            reply.headers['cache-control'] === 'public,max-age=31536000,immutable' &&
            /^(?:text\/css|(?:text|application)\/javascript|image\/(?:png|jpeg|svg\+xml|webp|avif|gif|x-icon|vnd\.microsoft\.icon)|font\/(?:woff2?|ttf|otf))(?:;|$)/i.test(reply.headers['content-type'] || '')) ||
            // sirv's 304 omits asset headers. The build inventory still proves
            // this URL names a non-sensitive file; SSR explicitly sets no-store.
            (reply.statusCode === 304 && req.headers['if-none-match'] && !reply.headers['cache-control'])) &&
          !reply.headers['set-cookie'];
        const responseHeaders = { ...reply.headers, ...headers };
        if (immutable) responseHeaders['cache-control'] = 'public,max-age=31536000,immutable';
        else if (req.url.split('?')[0].startsWith(immutablePrefix)) {
          responseHeaders['cache-control'] = privateResponse ? 'private, no-store' : 'no-store';
        }
        // Retain CRM noindex even for public, non-sensitive build resources.
        res.writeHead(reply.statusCode, responseHeaders);
        reply.pipe(res);
      },
    );
    upstream.setTimeout(180000, () => upstream.destroy());
    if (photoPath) {
      const deadline = setTimeout(() => upstream.destroy(new Error('Photo relay timeout')), 8000);
      res.once('close', () => clearTimeout(deadline));
    }
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, headers);
      res.end();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => {
      if (!res.writableEnded) upstream.destroy();
    });
    req.pipe(upstream);
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  return server;
}
