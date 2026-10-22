import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../db.js', () => ({ prisma: { task: { findMany: mocks.findMany } } }));
vi.mock('../middleware/clerk.js', () => ({
  requireUser: (req: any, _res: any, next: () => void) => {
    req.user = { id: req.headers['x-test-user'] || 'me' };
    next();
  },
}));
import router from './dashboardTasks.js';
let server: Server, base: string;
const row = (id: string, overdue = false) => ({
  id,
  title: id,
  priority: 'LOW',
  status: 'TODO',
  dueDate: overdue ? new Date('2020-01-01') : null,
  assignee: null,
});
beforeAll(async () => {
  const app = express();
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((done) => server.once('listening', done));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));
beforeEach(() => mocks.findMany.mockReset());
describe('current dashboard task selection', () => {
  it('queries current rows on every visit, including creations and completions', async () => {
    mocks.findMany
      .mockResolvedValueOnce([row('old')])
      .mockResolvedValueOnce([row('new'), row('old')])
      .mockResolvedValueOnce([row('new')]);
    const read = async () => {
      const response = await fetch(base + '/today-tasks?scope=mine');
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      return (await response.json()).items.map((t: any) => t.id);
    };
    expect(await read()).toEqual(['old']);
    expect(await read()).toEqual(['new', 'old']);
    expect(await read()).toEqual(['new']);
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
  });
  it('rebuilds own/general scope for the authenticated actor on every request', async () => {
    mocks.findMany.mockResolvedValue([]);
    await fetch(base + '/today-tasks?scope=mine', { headers: { 'x-test-user': 'person-2' } });
    expect(mocks.findMany.mock.calls[0][0].where.AND[1]).toEqual({
      OR: [{ assigneeId: 'person-2' }, { assigneeId: null }],
    });
    await fetch(base + '/today-tasks?scope=general');
    expect(mocks.findMany.mock.calls[1][0].where.AND[1]).toEqual({ assigneeId: null });
  });
  it('orders an overdue task ahead of urgent work without a due date', async () => {
    mocks.findMany.mockResolvedValue([
      { ...row('urgent'), priority: 'URGENT', status: 'IN_PROGRESS' },
      row('overdue', true),
    ]);
    const data = await (await fetch(base + '/today-tasks?scope=all')).json();
    expect(data.items.map((t: any) => t.id)).toEqual(['overdue', 'urgent']);
  });
  it('rejects a missing by-user filter instead of broadening it to everyone', async () => {
    expect((await fetch(base + '/today-tasks?scope=byUser')).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
