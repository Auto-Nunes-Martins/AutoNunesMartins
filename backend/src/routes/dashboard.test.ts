import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ loadDashboard: vi.fn(), loadTodayTasks: vi.fn() }));
vi.mock('../lib/server/dashboardService.js', () => mocks);
vi.mock('../middleware/clerk.js', () => ({
  requireUser: (req: any, _res: any, next: () => void) => {
    req.user = { id: req.headers['x-test-user'] || 'me' };
    next();
  },
}));
import router from './dashboard.js';
import { cache } from '../lib/data/cache.js';
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((done) => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));
beforeEach(() => {
  cache.clearAll();
  vi.resetAllMocks();
});
describe('dashboard aggregate cache', () => {
  it('reuses aggregates while reading actionable tasks fresh on cache hits', async () => {
    mocks.loadDashboard.mockResolvedValue({
      kpis: { value: 'aggregate' },
      todayTasks: [{ id: 'old' }],
    });
    mocks.loadTodayTasks.mockResolvedValueOnce([{ id: 'created' }]).mockResolvedValueOnce([]);
    const first = await fetch(base + '/');
    expect(first.headers.get('cache-control')).toBe('private, no-store');
    expect((await first.json()).todayTasks).toEqual([{ id: 'old' }]);
    expect((await (await fetch(base + '/')).json()).todayTasks).toEqual([{ id: 'created' }]);
    expect((await (await fetch(base + '/')).json()).todayTasks).toEqual([]);
    expect(mocks.loadDashboard).toHaveBeenCalledTimes(1);
    expect(mocks.loadTodayTasks).toHaveBeenCalledTimes(2);
  });
  it('separates authenticated actors when reusing aggregates', async () => {
    mocks.loadDashboard.mockImplementation(async (actor) => ({ todayTasks: [{ id: actor }] }));
    await fetch(base + '/', { headers: { 'x-test-user': 'actor-a' } });
    const response = await fetch(base + '/', { headers: { 'x-test-user': 'actor-b' } });
    expect((await response.json()).todayTasks).toEqual([{ id: 'actor-b' }]);
    expect(mocks.loadDashboard).toHaveBeenCalledTimes(2);
  });
});
