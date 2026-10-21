import { describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';
const capture = vi.hoisted(() => ({ options: {} as any }));
vi.mock('./env.js', () => ({ getEnv: () => ({ NODE_ENV: 'test', LOG_LEVEL: 'info' }) }));
vi.mock('pino', async (original) => {
  const actual = await original<typeof import('pino')>();
  return { ...actual, default: Object.assign((options: any, ...args: any[]) => {
    capture.options = options;
    return actual.default(options, ...args);
  }, actual.default) };
});
import './logger.js';
describe('authentication log redaction', () => {
  it('removes bearer/session cookies from HTTP logs while preserving request diagnostics', () => {
    let output = '';
    const stream = new Writable({ write(chunk, _encoding, done) { output += chunk.toString(); done(); } });
    const logger = pino(capture.options, stream);
    logger.info({ req: { method: 'GET', url: '/api/me', headers: { authorization: 'Bearer SECRET', cookie: '__session=SECRET' } }, res: { headers: { 'set-cookie': '__session=SECRET' } } });
    expect(output).not.toContain('SECRET');
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('/api/me');
  });
});
