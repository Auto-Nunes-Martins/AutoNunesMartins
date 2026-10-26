import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  read: vi.fn(),
  tombstoneRead: vi.fn(),
  available: vi.fn(),
  identityLock: vi.fn(),
  activity: vi.fn(),
  boardLock: vi.fn(),
}));
vi.mock('../../db.js', () => ({
  prisma: { $transaction: mocks.transaction, user: { findUnique: mocks.read } },
}));
vi.mock('./userLifecycleSchema.js', async (original) => ({
  ...(await original<typeof import('./userLifecycleSchema.js')>()),
  userLifecycleAvailable: mocks.available,
  lockClerkIdentity: mocks.identityLock,
}));
vi.mock('../data/activity.js', () => ({ emitActivity: mocks.activity }));
vi.mock('../../logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
import { deactivateLocalUser, syncLocalUser, readLocalUser } from './userLifecycle.js';
import { createTask, updateTask, TaskValidationError } from './taskService.js';
import { getTaskByIdForActor } from '../data/task.js';
import { cache } from '../data/cache.js';
let state: any, serial: Promise<unknown>;
const profile = { email: 'old@example.org', name: 'Original', imageUrl: null };
const selected = (row: any, select: any) =>
  row
    ? Object.fromEntries(Object.entries(row).filter(([key]) => !select || select[key] === true))
    : null;
function txClient() {
  const matchesUser = (row: any, where: any) =>
    (!where.id || where.id === row.id) &&
    (!where.clerkId || where.clerkId === row.clerkId) &&
    (!Object.hasOwn(where, 'deactivatedAt') || row.deactivatedAt === where.deactivatedAt);
  const matchesTask = (row: any, where: any) =>
    (!where.id || where.id === row.id) &&
    (!Object.hasOwn(where, 'assigneeId') || where.assigneeId === row.assigneeId) &&
    (!where.status?.not || row.status !== where.status.not) &&
    (!where.OR || where.OR.some((clause: any) => clause.assigneeId === row.assigneeId));
  return {
    $queryRaw: mocks.boardLock,
    activityLog: {
      createMany: async ({ data }: any) => {
        for (const input of data) await mocks.activity(null, input);
        return { count: data.length };
      },
    },
    user: {
      findUnique: async ({ where, select }: any) =>
        selected(
          state.users.find((row: any) => matchesUser(row, where)),
          select,
        ),
      findFirst: async ({ where, select }: any) =>
        selected(
          state.users.find((row: any) => matchesUser(row, where)),
          select,
        ),
      upsert: async ({ where, create, update, select }: any) => {
        let row = state.users.find((r: any) => r.clerkId === where.clerkId);
        if (row) Object.assign(row, update);
        else {
          row = { id: 'new-user', deactivatedAt: null, ...create };
          state.users.push(row);
        }
        return selected(row, select);
      },
      updateMany: async ({ where, data }: any) => {
        const rows = state.users.filter((row: any) => matchesUser(row, where));
        rows.forEach((row: any) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    clerkUserDeletion: {
      findUnique: async ({ where }: any) => state.deleted.get(where.clerkId) ?? null,
      upsert: async ({ where }: any) => {
        if (!state.deleted.has(where.clerkId))
          state.deleted.set(where.clerkId, { clerkId: where.clerkId, deletedAt: new Date() });
        return state.deleted.get(where.clerkId);
      },
    },
    task: {
      findMany: async ({ where }: any) => state.tasks.filter((row: any) => matchesTask(row, where)),
      findFirst: async ({ where }: any) =>
        state.tasks.find((row: any) => matchesTask(row, where)) ?? null,
      findUnique: async ({ where }: any) =>
        state.tasks.find((row: any) => row.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        const rows = state.tasks.filter((row: any) => matchesTask(row, where));
        rows.forEach((row: any) => {
          row.assigneeId = data.assigneeId;
          row.boardVersion += data.boardVersion.increment;
        });
        return { count: rows.length };
      },
      create: async ({ data }: any) => {
        const row = { id: 'new-task', boardVersion: 0, ...data };
        state.tasks.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = state.tasks.find((r: any) => r.id === where.id);
        if (data.assignee?.connect) row.assigneeId = data.assignee.connect.id;
        if (data.assignee?.disconnect) row.assigneeId = null;
        row.boardVersion += data.boardVersion?.increment ?? 0;
        return row;
      },
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  cache.clearAll();
  serial = Promise.resolve();
  mocks.available.mockResolvedValue(true);
  state = {
    users: [
      { id: 'old', clerkId: 'clerk_old', role: 'ADMIN', deactivatedAt: null, ...profile },
      { id: 'active', clerkId: 'clerk_active', role: 'ADMIN', deactivatedAt: null, ...profile },
    ],
    deleted: new Map(),
    tasks: ['TODO', 'IN_PROGRESS', 'DONE'].map((status, i) => ({
      id: 'task' + i,
      title: 'Task ' + i,
      status,
      assigneeId: 'old',
      boardVersion: 7,
      recurrence: 'NONE',
      dueDate: null,
      boardPosition: new Prisma.Decimal(1024),
    })),
    logs: [{ actorId: 'old', message: 'Original history' }],
  };
  mocks.transaction.mockImplementation((callback: any) => {
    const run = serial.then(async () => {
      const snapshot = {
        users: state.users.map((row: any) => ({ ...row })),
        deleted: new Map(state.deleted),
        tasks: state.tasks.map((row: any) => ({ ...row })),
        logs: [...state.logs],
      };
      try {
        return await callback(txClient());
      } catch (error) {
        state = snapshot;
        throw error;
      }
    });
    serial = run.catch(() => {});
    return run;
  });
  mocks.tombstoneRead.mockImplementation((args: any) =>
    txClient().clerkUserDeletion.findUnique(args),
  );
  mocks.read.mockImplementation((args: any) => txClient().user.findUnique(args));
  mocks.activity.mockImplementation(async (_tx: any, input: any) => state.logs.push(input));
});
it('retains identity/history/DONE attribution while releasing only pending tasks to Geral', async () => {
  cache.set('users:list', ['old'], 60000);
  cache.set('dashboard:active', {}, 60000);
  cache.set('notifications:active', {}, 60000);
  expect(await deactivateLocalUser('clerk_old')).toEqual({ released: 2 });
  expect(state.users[0]).toMatchObject({ ...profile, id: 'old', deactivatedAt: expect.any(Date) });
  expect(state.tasks.map((t: any) => [t.assigneeId, t.boardVersion])).toEqual([
    [null, 8],
    [null, 8],
    ['old', 7],
  ]);
  expect(state.logs[0]).toEqual({ actorId: 'old', message: 'Original history' });
  expect(state.logs.slice(1).every((log: any) => log.metadata.previousAssigneeId === 'old')).toBe(
    true,
  );
  expect(cache.get('users:list')).toBeUndefined();
  expect(cache.get('dashboard:active')).toBeUndefined();
  expect(cache.get('notifications:active')).toBeUndefined();
  expect(await getTaskByIdForActor(txClient() as any, 'task0', 'active')).toMatchObject({
    assigneeId: null,
  });
  await updateTask('task0', { assigneeId: 'active' }, { actorId: 'active', actorName: 'Active' });
  expect(state.tasks[0].assigneeId).toBe('active');
});
it('is idempotent on replay, preserving deletion time and avoiding duplicate task activity', async () => {
  await deactivateLocalUser('clerk_old');
  const date = state.users[0].deactivatedAt;
  const logs = state.logs.length;
  expect(await deactivateLocalUser('clerk_old')).toEqual({ released: 0 });
  expect(state.users[0].deactivatedAt).toEqual(date);
  expect(state.logs).toHaveLength(logs);
});
it('records unknown deletions and refuses delayed create/update/first-access provisioning', async () => {
  await deactivateLocalUser('unknown');
  for (const update of [true, false])
    expect(await syncLocalUser('unknown', profile, update)).toBeNull();
  expect(state.users).toHaveLength(2);
  await deactivateLocalUser('clerk_old');
  expect(await syncLocalUser('clerk_old', { ...profile, name: 'Stale' })).toBeNull();
  expect((await readLocalUser('clerk_old'))?.deactivatedAt).toBeTruthy();
  expect(state.users[0].name).toBe('Original');
});
it('serializes deletion versus provisioning and rejects later assignments to inactive profiles', async () => {
  await Promise.all([syncLocalUser('unknown', profile, false), deactivateLocalUser('unknown')]);
  expect(state.users.find((u: any) => u.clerkId === 'unknown').deactivatedAt).toBeTruthy();
  expect(await syncLocalUser('unknown', profile)).toBeNull();
  await deactivateLocalUser('clerk_old');
  await expect(
    createTask({ title: 'Wrong', assigneeId: 'old' }, { actorId: 'active', actorName: 'Active' }),
  ).rejects.toBeInstanceOf(TaskValidationError);
  await expect(
    updateTask('task0', { assigneeId: 'old' }, { actorId: 'active', actorName: 'Active' }),
  ).rejects.toBeInstanceOf(TaskValidationError);
});
it('rolls profile, tombstone, assignments and task activity back together on failure', async () => {
  mocks.activity.mockRejectedValueOnce(new Error('audit failed'));
  await expect(deactivateLocalUser('clerk_old')).rejects.toThrow('audit failed');
  expect(state.users[0].deactivatedAt).toBeNull();
  expect(state.deleted.size).toBe(0);
  expect(state.tasks.every((t: any) => t.assigneeId === 'old' && t.boardVersion === 7)).toBe(true);
  expect(state.logs).toHaveLength(1);
});
it('keeps old-schema permission reads/sync compatible and fails deletion closed before writes', async () => {
  mocks.available.mockResolvedValue(false);
  await readLocalUser('clerk_old');
  expect(mocks.read.mock.calls[0][0].select).not.toHaveProperty('deactivatedAt');
  await syncLocalUser('new-clerk', profile, false);
  expect(state.users.find((u: any) => u.clerkId === 'new-clerk')).toBeTruthy();
  mocks.transaction.mockClear();
  await expect(deactivateLocalUser('clerk_old')).rejects.toThrow('migration required');
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it('serializes task assignment and deletion in either order without orphaning new pending work', async () => {
  await Promise.all([
    createTask({ title: 'Race', assigneeId: 'old' }, { actorId: 'active', actorName: 'Active' }),
    deactivateLocalUser('clerk_old'),
  ]);
  expect(state.tasks.find((t: any) => t.title === 'Race').assigneeId).toBeNull();
  const deleteFirst = deactivateLocalUser('clerk_active');
  await Promise.resolve();
  const result = await Promise.allSettled([
    deleteFirst,
    createTask({ title: 'Late', assigneeId: 'active' }, { actorId: 'active', actorName: 'Active' }),
  ]);
  expect(result[1].status).toBe('rejected');
  expect(state.tasks.find((t: any) => t.title === 'Late')).toBeUndefined();
});
it('does not mutate a terminal profile from an in-flight avatar refresh', async () => {
  const { backfillLocalAvatar } = await import('./userLifecycle.js');
  await deactivateLocalUser('clerk_old');
  await backfillLocalAvatar('clerk_old', 'stale-avatar');
  expect(state.users[0].imageUrl).toBeNull();
});
