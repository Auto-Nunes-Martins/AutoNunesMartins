import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import express from 'express';
const state = vi.hoisted(() => ({ role: 'ADMIN', query: vi.fn() }));
vi.mock('../db.js', () => ({ prisma: { $queryRaw: state.query } }));
vi.mock('../middleware/clerk.js', () => ({
  requireUser: (req: any, res: any, next: any) => {
    if (state.role === 'NONE') {
      res.status(401).end();
      return;
    }
    req.user = { role: state.role };
    next();
  },
}));
import router from './diagnostics';
let server: ReturnType<ReturnType<typeof express>['listen']>, base: string;
beforeAll(async () => {
  const app = express();
  app.use('/diagnostics', router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = 'http://127.0.0.1:' + (server.address() as any).port;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
it('requires an active admin and never queries or caches private metrics for unauthorized callers', async () => {
  state.query.mockClear();
  state.role = 'NONE';
  expect((await fetch(base + '/diagnostics')).status).toBe(401);
  state.role = 'USER';
  const denied = await fetch(base + '/diagnostics');
  expect(denied.status).toBe(403);
  expect(denied.headers.get('cache-control')).toContain('no-store');
  expect(state.query).not.toHaveBeenCalled();
  state.role = 'ADMIN';
});
it('rejects invalid or oversized intervals and pages before touching the database', async () => {
  state.query.mockClear();
  for (const search of [
    '?from=bad',
    '?limit=100000',
    '?limit=101',
    '?after=invalid',
    '?after=9999999999999999999',
    '?from=2020-01-01T00:00:00Z&to=2020-02-01T00:00:00Z',
    '?instance=other',
    '?unexpected=1',
  ])
    expect((await fetch(base + '/diagnostics' + search)).status).toBe(400);
  expect(state.query).not.toHaveBeenCalled();
});
it('returns a bounded receipt-ordered page with source timestamps and a stable numeric cursor', async () => {
  state.query.mockResolvedValue([
    { id: '1', occurredAt: new Date(), payload: { processSequence: 1 } },
    { id: '2', occurredAt: new Date(), payload: { processSequence: 2 } },
  ]);
  const response = await fetch(base + '/diagnostics?limit=1&after=0');
  const result = await response.json();
  expect(result.events).toHaveLength(1);
  expect(result.next).toBe('1');
  expect(result.order).toBe('receipt_sequence');
  expect(result.from).toMatch(/Z$/);
  expect(state.query.mock.calls.at(-1)[0].text).toContain('ORDER BY "id" ASC');
});
