import { isIP } from 'node:net';

// Only the loopback-bound website adapter consumes this gateway-owned header.
export const clientAddressHeader = 'x-anm-client-address';

export function normaliseAddress(value) {
  if (typeof value !== 'string' || value.includes('%') || !isIP(value)) return null;
  if (isIP(value) === 4) return value;
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  // Treat IPv4 and IPv4-mapped IPv6 as the same rate-limit identity.
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return canonical;
}

export function clientAddress(req, source) {
  // Render documents that its public Cloudflare ingress overwrites this header.
  // Never infer trust from the hostname, XFF, CF-Ray or a caller-supplied flag.
  // Missing/malformed trusted metadata fails closed instead of using proxy IP.
  if (source !== 'render' && source !== 'socket') return null;
  return normaliseAddress(source === 'render'
    ? req.headers['cf-connecting-ip']
    : req.socket.remoteAddress);
}
