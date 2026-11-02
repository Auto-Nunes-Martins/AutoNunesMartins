import express, { type NextFunction, type Response } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import type { AuthedRequest } from '../middleware/clerk.js';

const mocks = vi.hoisted(() => ({ tasks: vi.fn(), vehicles: vi.fn(), customers: vi.fn() }));
vi.mock('../db.js', () => ({
  prisma: {
    task: { findMany: mocks.tasks },
    vehicle: { findMany: mocks.vehicles },
    customer: { findMany: mocks.customers },
  },
}));
vi.mock('../middleware/clerk.js', () => ({
  requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
    const id = req.get('x-fixture-user');
    if (!id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = {
      id,
      clerkId: `fixture-${id}`,
      name: id,
      email: `${id}@example.test`,
      role: 'ADMIN',
    };
    next();
  },
}));
import router from './search.js';
import { cache } from '../lib/data/cache.js';

type Task = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  status: string;
  priority: string;
};
let rows: Task[];
function matches(row: Task, where: Prisma.TaskWhereInput): boolean {
  if (where.AND) {
    const clauses = Array.isArray(where.AND) ? where.AND : [where.AND];
    if (!clauses.every((clause) => matches(row, clause))) return false;
  }
  if (where.OR && !where.OR.some((clause) => matches(row, clause))) return false;
  if (Object.hasOwn(where, 'assigneeId') && where.assigneeId !== row.assigneeId) return false;
  for (const field of ['title', 'description'] as const) {
    const filter = where[field];
    if (
      filter &&
      typeof filter === 'object' &&
      typeof filter.contains === 'string' &&
      !row[field].toLowerCase().includes(filter.contains.toLowerCase())
    )
      return false;
  }
  return true;
}

let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  app.use('/search', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/search`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => {
  cache.clearAll();
  vi.clearAllMocks();
  rows = [
    { id: 'a', title: 'Revisão A', assigneeId: 'alice', status: 'TODO' },
    { id: 'b', title: 'Revisão B', assigneeId: 'bob', status: 'IN_PROGRESS' },
    { id: 'general', title: 'Revisão Geral', assigneeId: null, status: 'DONE' },
    { id: 'description', title: 'Outro título', assigneeId: 'alice', status: 'TODO' },
  ].map((row) => ({
    ...row,
    description: row.id === 'description' ? 'Revisão agendada' : '',
    priority: 'MEDIUM',
  }));
  mocks.tasks.mockImplementation(async ({ where, take }: Prisma.TaskFindManyArgs) =>
    rows.filter((row) => matches(row, where ?? {})).slice(0, take ?? rows.length),
  );
  mocks.vehicles.mockResolvedValue([]);
  mocks.customers.mockResolvedValue([]);
});
const search = (actor: string, query = 'revisão') =>
  fetch(`${base}?q=${encodeURIComponent(query)}`, {
    headers: { 'x-fixture-user': actor },
  }).then((response) => response.json());

it('returns only own and general tasks, including title/description matches and every status', async () => {
  const alice = await search('alice');
  expect(alice.tasks.map((task: Task) => task.id)).toEqual(['a', 'general', 'description']);
  expect(alice.total).toBe(3);
  const bob = await search('bob');
  expect(bob.tasks.map((task: Task) => task.id)).toEqual(['b', 'general']);
  await search('alice');
  await search('bob');
  expect(mocks.tasks).toHaveBeenCalledTimes(2);
});

it('does not confuse actor/query delimiters or share authenticated payloads with anonymous requests', async () => {
  await search('alice:revisão', 'x');
  await search('alice', 'revisão:x');
  expect(mocks.tasks).toHaveBeenCalledTimes(2);
  expect((await fetch(`${base}?q=revisão`)).status).toBe(401);
  expect(mocks.tasks).toHaveBeenCalledTimes(2);
});

it('rechecks task visibility after a committed mutation invalidates search results', async () => {
  await search('alice');
  rows[0]!.assigneeId = 'bob';
  cache.clearPrefix('search:');
  expect((await search('alice')).tasks.map((task: Task) => task.id)).toEqual([
    'general',
    'description',
  ]);
  expect((await search('bob')).tasks.map((task: Task) => task.id)).toEqual(['a', 'b', 'general']);
});

it('preserves validation and avoids database work for blank terms', async () => {
  expect(
    (await fetch(`${base}?q=x&limit=11`, { headers: { 'x-fixture-user': 'alice' } })).status,
  ).toBe(400);
  expect((await search('alice', '   ')).total).toBe(0);
  expect(mocks.tasks).not.toHaveBeenCalled();
});
