import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Compile dependencies during collection, before per-test fake clocks start.
import './taskService.js';

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  queryRaw: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  emitActivity: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock('../../db.js', () => ({
  prisma: {
    task: { deleteMany: mocks.deleteMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../data/activity.js', () => ({ emitActivity: mocks.emitActivity }));
vi.mock('../../logger.js', () => ({ logger: { warn: mocks.warn, info: mocks.info } }));

// Local dates exercise the same local-midnight policy as the production helper.
const sunday = new Date(2026, 9, 11);
const tuesday = new Date(2026, 9, 13, 12);
const actor = { actorId: 'actor', actorName: 'Test actor' };

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(tuesday);
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      $queryRaw: mocks.queryRaw,
      task: {
        deleteMany: mocks.deleteMany,
        create: mocks.create,
        findUnique: mocks.findUnique,
        findFirst: mocks.findFirst,
        update: mocks.update,
      },
    }),
  );
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'created', ...data }));
  mocks.findFirst.mockResolvedValue(null);
  mocks.update.mockImplementation(async ({ data }) => ({ id: 'task', title: 'Task', ...data }));
});

afterEach(() => vi.useRealTimers());

describe('weekly completed-task cleanup', () => {
  it('deletes only DONE history strictly before Sunday, preserving recent, boundary and undated tasks after restart', async () => {
    const rows = [
      { id: 'old', status: 'DONE', completedAt: new Date(sunday.getTime() - 1) },
      { id: 'boundary', status: 'DONE', completedAt: sunday },
      { id: 'recent', status: 'DONE', completedAt: tuesday },
      { id: 'undated', status: 'DONE', completedAt: null },
      { id: 'unfinished', status: 'TODO', completedAt: new Date(2026, 8, 1) },
    ];
    mocks.deleteMany.mockImplementation(async ({ where }) => {
      // This fake models SQL's null exclusion for a strict timestamp comparison.
      const deleted = rows.filter(
        (row) =>
          row.status === where.status &&
          (!where.completedAt ||
            (row.completedAt !== null && row.completedAt < where.completedAt.lt)),
      );
      for (const row of deleted) rows.splice(rows.indexOf(row), 1);
      return { count: deleted.length };
    });
    let service = await import('./taskService.js');
    expect(await service.purgeStaleCompletedTasks()).toBe(1);
    expect(rows.map((row) => row.id)).toEqual(['boundary', 'recent', 'undated', 'unfinished']);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { status: 'DONE', completedAt: { lt: sunday } },
    });
    expect(await service.purgeStaleCompletedTasks()).toBe(0);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);

    vi.resetModules(); // A process restart loses the in-memory guard.
    service = await import('./taskService.js');
    expect(await service.purgeStaleCompletedTasks()).toBe(0);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(2);
    expect(rows.map((row) => row.id)).toEqual(['boundary', 'recent', 'undated', 'unfinished']);
  });

  it('shares an in-flight cleanup across concurrent list requests', async () => {
    let finish!: (value: { count: number }) => void;
    mocks.deleteMany.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { purgeStaleCompletedTasks } = await import('./taskService.js');
    const first = purgeStaleCompletedTasks();
    const second = purgeStaleCompletedTasks();
    expect(second).toBe(first);
    finish({ count: 3 });
    expect(await Promise.all([first, second])).toEqual([3, 3]);
    expect(await purgeStaleCompletedTasks()).toBe(0);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('swallows and logs a database failure, then retries the same boundary', async () => {
    const failure = new Error('database unavailable');
    mocks.deleteMany.mockRejectedValueOnce(failure).mockResolvedValueOnce({ count: 2 });
    const { purgeStaleCompletedTasks } = await import('./taskService.js');
    expect(await purgeStaleCompletedTasks()).toBe(0);
    expect(mocks.warn).toHaveBeenCalledWith({ err: failure }, expect.any(String));
    expect(await purgeStaleCompletedTasks()).toBe(2);
    expect(mocks.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('runs again for the new Sunday when an in-flight cleanup crosses midnight', async () => {
    const saturday = new Date(2026, 9, 17, 23, 59);
    const nextSunday = new Date(2026, 9, 18);
    vi.setSystemTime(saturday);
    let finish!: (value: { count: number }) => void;
    mocks.deleteMany.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { purgeStaleCompletedTasks } = await import('./taskService.js');
    const first = purgeStaleCompletedTasks();
    vi.setSystemTime(new Date(2026, 9, 18, 0, 1));
    finish({ count: 0 });
    await first;
    await purgeStaleCompletedTasks();
    expect(mocks.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { status: 'DONE', completedAt: { lt: sunday } },
    });
    expect(mocks.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { status: 'DONE', completedAt: { lt: nextSunday } },
    });
  });
});

describe('completion timestamps', () => {
  it('dates tasks created as DONE and leaves new TODO tasks undated', async () => {
    const { createTask } = await import('./taskService.js');
    await createTask({ title: 'Done task', status: 'DONE' }, actor);
    await createTask({ title: 'New task' }, actor);
    expect(mocks.create.mock.calls[0][0].data.completedAt).toEqual(tuesday);
    expect(mocks.create.mock.calls[1][0].data.completedAt).toBeNull();
  });

  it('sets completion time on DONE and clears it when reopened', async () => {
    const { changeTaskStatus } = await import('./taskService.js');
    mocks.findUnique.mockResolvedValueOnce({
      id: 'task',
      title: 'Task',
      status: 'TODO',
      recurrence: 'NONE',
      completedAt: null,
    });
    await changeTaskStatus('task', 'DONE', actor);
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      status: 'DONE',
      completedAt: tuesday,
    });
    mocks.findUnique.mockResolvedValueOnce({
      id: 'task',
      title: 'Task',
      status: 'DONE',
      recurrence: 'NONE',
      completedAt: tuesday,
    });
    await changeTaskStatus('task', 'TODO', actor);
    expect(mocks.update.mock.calls[1][0].data).toMatchObject({ status: 'TODO', completedAt: null });
  });
});
