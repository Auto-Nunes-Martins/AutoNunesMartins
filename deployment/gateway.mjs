import http from 'node:http';
import { selectRoute } from './routing.mjs';

export function createGateway(settings, ports, ready = () => true) {
  const server = http.createServer((req, res) => {
    const route = selectRoute(settings, req.headers.host, req.url);
    if (!route) {
      res.writeHead(421, { 'cache-control': 'no-store' });
      res.end();
      return;
    }
    const privateResponse = route.service !== 'website';
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
        ].includes(key)
      )
        delete forwarded[key];
    }
    forwarded['x-forwarded-proto'] = new URL(route.origin).protocol.slice(0, -1);
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: ports[route.service],
        path: req.url,
        method: req.method,
        headers: forwarded,
      },
      (reply) => {
        // Enforce isolation even on redirects, static responses and errors.
        res.writeHead(reply.statusCode, { ...reply.headers, ...headers });
        reply.pipe(res);
      },
    );
    upstream.setTimeout(180000, () => upstream.destroy());
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
