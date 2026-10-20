import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { betweenPositions } from './taskBoardOrder.js';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), activity: vi.fn(), lock: vi.fn() }));
vi.mock('../../db.js', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('../data/activity.js', () => ({ emitActivity: mocks.activity }));
vi.mock('../../logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn() } }));
import {
  moveTask,
  changeTaskStatus,
  updateTask,
  TaskBoardConflict,
  TaskNotFound,
} from './taskService.js';

const actor = { actorId: 'alice', actorName: 'Alice' };
const decimal = (value: number | string) => new Prisma.Decimal(value);
const makeTask = (id: string, rank: number, assigneeId: string | null = 'alice') => ({
  id,
  title: id,
  status: 'TODO',
  priority: 'HIGH',
  description: null,
  assigneeId,
  boardPosition: decimal(rank),
  boardVersion: 0,
  completedAt: null,
  dueDate: new Date('2026-10-20'),
  startDate: null,
  reminderDate: null,
  recurrence: 'NONE',
  recurrenceParentId: null,
});
let rows: ReturnType<typeof makeTask>[];
let writes: Record<string, unknown>[];

beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    makeTask('a', 1024),
    makeTask('hidden', 2048, 'bob'),
    makeTask('general', 3072, null),
    makeTask('d', 4096),
  ];
  writes = [];
  let serial: Promise<unknown> = Promise.resolve();
  // Models the shared transaction lock and rollback. SQL migration is tested in PostgreSQL separately.
  mocks.transaction.mockImplementation((callback) => {
    const operation = serial.then(async () => {
      const snapshot = rows.map((row) => ({ ...row }));
      const tx = {
        $queryRaw: mocks.lock,
        task: {
          findUnique: async ({ where }: any) => rows.find((row) => row.id === where.id) ?? null,
          findFirst: async ({ where }: any) =>
            [...rows]
              .filter((row) => row.status === where.status)
              .sort((a, b) => b.boardPosition.comparedTo(a.boardPosition))[0] ?? null,
          findMany: async ({ where }: any) =>
            rows
              .filter((row) => row.status === where.status && row.id !== where.id?.not)
              .sort((a, b) => a.boardPosition.comparedTo(b.boardPosition))
              .map((row) => ({ id: row.id, boardPosition: row.boardPosition })),
          update: async ({ where, data }: any) => {
            writes.push(data);
            const index = rows.findIndex((row) => row.id === where.id);
            const current = rows[index]!;
            rows[index] = {
              ...current,
              ...data,
              boardVersion: current.boardVersion + (data.boardVersion?.increment ?? 0),
            };
            return rows[index];
          },
          create: async ({ data }: any) => {
            const row = { ...makeTask('spawn-' + rows.length, 0), ...data };
            rows.push(row);
            return row;
          },
        },
      };
      try {
        return await callback(tx);
      } catch (error) {
        rows = snapshot;
        throw error;
      }
    });
    serial = operation.catch(() => {});
    return operation;
  });
});

describe('persisted task moves', () => {
  it('reorders a filtered projection without changing status, dates, assignment, or hidden relative order', async () => {
    const original = rows.map((row) => ({ ...row }));
    await moveTask(
      'd',
      {
        status: 'TODO',
        expectedVersion: 0,
        before: { id: 'a', version: 0 },
        after: { id: 'general', version: 0 },
      },
      actor,
    );
    expect(
      [...rows].sort((a, b) => a.boardPosition.comparedTo(b.boardPosition)).map((row) => row.id),
    ).toEqual(['a', 'hidden', 'd', 'general']);
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0]!)).toEqual(['boardPosition', 'boardVersion']);
    expect(rows.find((row) => row.id === 'd')).toMatchObject({
      ...original[3],
      boardPosition: decimal(2560),
      boardVersion: 1,
    });
    expect(rows.filter((row) => row.id !== 'd')).toEqual(original.filter((row) => row.id !== 'd'));
    expect(mocks.activity).not.toHaveBeenCalled();
    expect(mocks.lock.mock.calls[0]![0].join('')).toContain('pg_advisory_xact_lock');
  });

  it('rejects stale task and neighbour versions, status changes and private anchors', async () => {
    const move = {
      status: 'TODO' as const,
      expectedVersion: 0,
      before: null,
      after: { id: 'general', version: 0 },
    };
    await expect(moveTask('d', { ...move, expectedVersion: 4 }, actor)).rejects.toBeInstanceOf(
      TaskBoardConflict,
    );
    await expect(
      moveTask('d', { ...move, after: { id: 'general', version: 3 } }, actor),
    ).rejects.toBeInstanceOf(TaskBoardConflict);
    await expect(moveTask('d', { ...move, status: 'DONE' }, actor)).rejects.toBeInstanceOf(
      TaskBoardConflict,
    );
    await expect(
      moveTask('d', { ...move, after: { id: 'hidden', version: 0 } }, actor),
    ).rejects.toBeInstanceOf(TaskNotFound);
    await expect(moveTask('hidden', move, actor)).rejects.toBeInstanceOf(TaskNotFound);
    expect(writes).toHaveLength(0);
  });

  it('saves status, position and recurring successor atomically and does not duplicate a competing completion', async () => {
    rows[0]!.recurrence = 'WEEKLY';
    const move = { status: 'DONE' as const, expectedVersion: 0, before: null, after: null };
    const results = await Promise.allSettled([
      moveTask('a', move, actor),
      moveTask('a', move, actor),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(rows.filter((row) => row.recurrenceParentId === 'a')).toHaveLength(1);
    expect(rows.find((row) => row.id === 'a')).toMatchObject({
      status: 'DONE',
      boardPosition: decimal(1024),
      boardVersion: 1,
    });
    await changeTaskStatus('a', 'DONE', actor);
    expect(rows.filter((row) => row.recurrenceParentId === 'a')).toHaveLength(1);
  });

  it('rolls back both status and position if the transaction fails after updating them', async () => {
    mocks.activity.mockRejectedValueOnce(new Error('activity unavailable'));
    const original = rows.map((row) => ({ ...row }));
    await expect(
      moveTask('a', { status: 'DONE', expectedVersion: 0, before: null, after: null }, actor),
    ).rejects.toThrow('activity unavailable');
    expect(rows).toEqual(original);
  });

  it('appends a status change from the quick panel without resetting existing column order', async () => {
    rows.push({ ...makeTask('in-progress', 8192, null), status: 'IN_PROGRESS' });
    await changeTaskStatus('a', 'IN_PROGRESS', actor);
    expect(rows.find((row) => row.id === 'a')?.boardPosition.toString()).toBe('9216');
    expect(rows.find((row) => row.id === 'in-progress')?.boardPosition.toString()).toBe('8192');
  });

  it('honours an explicit status edit with the edited recurrence data and rolls the whole edit back on failure', async () => {
    await updateTask('a', { title: 'Edited task', status: 'DONE', recurrence: 'WEEKLY' }, actor);
    expect(rows.find((row) => row.id === 'a')).toMatchObject({
      title: 'Edited task',
      status: 'DONE',
      recurrence: 'WEEKLY',
    });
    expect(rows.find((row) => row.recurrenceParentId === 'a')).toMatchObject({
      title: 'Edited task',
      status: 'TODO',
      recurrence: 'WEEKLY',
    });
    const before = rows.map((row) => ({ ...row }));
    mocks.activity.mockRejectedValueOnce(new Error('write failed'));
    await expect(updateTask('d', { title: 'Not saved', status: 'DONE' }, actor)).rejects.toThrow(
      'write failed',
    );
    expect(rows).toEqual(before);
  });

  it('explicitly clears optional dates and refuses a recurrence without its date', async () => {
    await updateTask(
      'a',
      { startDate: null, dueDate: null, reminderDate: null, assigneeId: '' },
      actor,
    );
    expect(writes[0]).toMatchObject({
      startDate: null,
      dueDate: null,
      reminderDate: null,
      assignee: { disconnect: true },
    });
    rows[0]!.recurrence = 'WEEKLY';
    await expect(updateTask('a', { dueDate: null }, actor)).rejects.toThrow('data de prazo');
  });
});

it('allocates exact decimal gaps and requests compaction when precision is exhausted', () => {
  expect(betweenPositions(decimal(1024), decimal(2048))?.toString()).toBe('1536');
  expect(betweenPositions(decimal('1'), decimal('1.000000000001'))).toBeNull();
  expect(betweenPositions(undefined, decimal(1024))?.toString()).toBe('0');
  expect(betweenPositions(decimal(2048), undefined)?.toString()).toBe('3072');
});
