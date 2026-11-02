import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// htmlparser2 is declared by @anm/types. Resolve from its owning workspace,
// rather than relying on an undeclared package being hoisted beside this test.
const sharedRequire = createRequire(new URL('../../../shared/types/package.json', import.meta.url));
const { Parser } = await import(pathToFileURL(sharedRequire.resolve('htmlparser2')).href);
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');

function boundaryFor(html, split) {
  const target = split === 'stats' ? 'orbit-stats' : 'hd-root';
  const stack = [];
  let depth = null;
  let boundary = null;
  let count = 0;
  let parser;
  parser = new Parser(
    {
      onopentag(name, attributes) {
        stack.push(name);
        if (name === 'section' && (attributes.class ?? '').split(/\s+/).includes(target)) {
          count++;
          assert.equal(depth, null);
          depth = stack.length;
        }
      },
      onclosetag(name, implied) {
        if (name === 'section' && depth === stack.length) {
          assert.equal(implied, false, 'Split only after the explicit section closing tag');
          boundary = parser.endIndex + 1;
          depth = null;
        }
        assert.equal(stack.pop(), name, 'The parsed HTML must remain balanced');
      },
    },
    { decodeEntities: false, recognizeSelfClosing: true },
  );
  parser.end(html);
  assert.equal(count, 1, `Expected one ${target} section`);
  assert.ok(boundary > 0);
  assert.equal(html.slice(boundary - 10, boundary), '</section>');
  assert.ok(html.lastIndexOf('window.initializeOrbitDocument();') > boundary);
  return Buffer.byteLength(html.slice(0, boundary));
}

export async function progressiveHero(upstream) {
  let profile;
  let failure;
  const deliveries = [];
  const server = createServer(async (request, response) => {
    try {
      const current = { ...profile };
      const url = new URL(request.url, upstream);
      const source = await fetch(url, {
        headers: { accept: request.headers.accept ?? '*/*', 'accept-encoding': 'identity' },
        redirect: 'manual',
      });
      const body = Buffer.from(await source.arrayBuffer());
      const headers = Object.fromEntries(
        [...source.headers].filter(
          ([name]) =>
            !['connection', 'transfer-encoding', 'content-length', 'content-encoding'].includes(
              name,
            ),
        ),
      );
      if (url.pathname === '/' && source.headers.get('content-type')?.includes('text/html')) {
        const html = body.toString('utf8');
        assert.ok(Buffer.from(html).equals(body), 'Lossless UTF-8 response');
        const boundary = boundaryFor(html, current.split);
        const prefix = body.subarray(0, boundary);
        const suffix = body.subarray(boundary);
        const delivery = {
          ...current,
          bytes: body.length,
          prefixBytes: prefix.length,
          suffixBytes: suffix.length,
          originalSha256: hash(body),
          rejoinedSha256: hash(Buffer.concat([prefix, suffix])),
          markerInPrefix: prefix.includes(Buffer.from('data-hero-layout-ready')),
          initializerInSuffix: suffix.includes(Buffer.from('window.initializeOrbitDocument();')),
          prefixEpoch: Date.now(),
        };
        deliveries.push(delivery);
        response.writeHead(source.status, headers);
        response.write(prefix);
        response.flushHeaders();
        setTimeout(() => {
          delivery.tailEpoch = Date.now();
          response.end(suffix);
        }, current.tailDelay);
      } else {
        if (source.headers.get('content-type')?.includes('text/css') && current.cssDelay)
          await new Promise((resolve) => setTimeout(resolve, current.cssDelay));
        response.writeHead(source.status, headers);
        response.end(body);
      }
    } catch (error) {
      failure = error;
      response.writeHead(500);
      response.end('Local progressive HTML fixture failed');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    configure(next) {
      profile = next;
    },
    delivery() {
      if (failure) throw failure;
      return deliveries.at(-1);
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
