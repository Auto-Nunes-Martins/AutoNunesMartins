import type { Prisma, Task } from '@prisma/client';
import { activeAssignee } from './userLifecycle.js';
import type { TaskCreate, TaskMove, TaskStatus, TaskUpdate } from '@anm/types';
import { prisma } from '../../db.js';
import { emitActivity } from '../data/activity.js';
import { mostRecentSundayMidnight } from '../domain/sunday.js';
import { shiftRecurrence } from '../domain/task.js';
import { logger } from '../../logger.js';
import type { ActorContext } from './vehicleService.js';
import { appendTaskPosition, lockTaskBoard, movedTaskPosition } from './taskBoardOrder.js';

/**
 * Weekly purge: remove DONE tasks completed before the most recent Sunday.
 * When a recurring task is completed, its next occurrence is already spawned
 * as a separate TODO task (see `changeTaskStatus`), so the completed parent
 * is history eligible for deletion on the next Sunday.
 *
 * `lastPurgeAt` is a module-level guard so the delete only fires once per
 * Sunday across all requests in this process. On backend restart the guard
 * resets — the completedAt predicate still protects this week's completions.
 * Tasks without a completion timestamp are preserved rather than guessed old.
 */
let lastPurgeAt = 0;
let purgeInFlight: Promise<number> | undefined;

/**
 * Opportunistic cleanup: removes eligible DONE history if we haven't run
 * since the most recent Sunday 00:00. Called from the list endpoint with
 * fire-and-forget semantics. Failures are logged and swallowed.
 */
export function purgeStaleCompletedTasks(): Promise<number> {
  if (purgeInFlight) return purgeInFlight;
  const sunday = mostRecentSundayMidnight();
  if (lastPurgeAt >= sunday.getTime()) return Promise.resolve(0);

  purgeInFlight = (async () => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        await lockTaskBoard(tx);
        return tx.task.deleteMany({
          where: { status: 'DONE', completedAt: { lt: sunday } },
        });
      });
      // Record the boundary actually processed, even if this call crossed Sunday.
      lastPurgeAt = sunday.getTime();
      if (result.count > 0) {
        logger.info(
          { deletedTasks: result.count, runFor: sunday.toISOString() },
          'Weekly Sunday purge of DONE tasks',
        );
      }
      return result.count;
    } catch (err) {
      logger.warn({ err }, 'Failed to purge DONE tasks (will retry next list call)');
      return 0;
    }
  })().finally(() => {
    purgeInFlight = undefined;
  });
  return purgeInFlight;
}

export class TaskNotFound extends Error {
  constructor(public readonly id: string) {
    super(`Task ${id} not found`);
    this.name = 'TaskNotFound';
  }
}

export class TaskValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

export class TaskBoardConflict extends Error {
  constructor() {
    super('O quadro mudou entretanto. Atualize-o e volte a mover a tarefa.');
    this.name = 'TaskBoardConflict';
  }
}

async function visibleTask(tx: Prisma.TransactionClient, id: string, actor: ActorContext) {
  const task = await tx.task.findUnique({ where: { id } });
  if (!task || (task.assigneeId && task.assigneeId !== actor.actorId)) throw new TaskNotFound(id);
  return task;
}

export async function createTask(data: TaskCreate, actor: ActorContext): Promise<{ id: string }> {
  const created = await prisma.$transaction(async (tx) => {
    await lockTaskBoard(tx);
    if (data.assigneeId && !(await activeAssignee(tx, data.assigneeId))) {
      throw new TaskValidationError('Escolha um responsável ativo.');
    }
    const task = await tx.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? 'TODO',
        completedAt: data.status === 'DONE' ? new Date() : null,
        priority: data.priority ?? 'MEDIUM',
        assigneeId: data.assigneeId || null,
        startDate: data.startDate ?? null,
        dueDate: data.dueDate ?? null,
        reminderDate: data.reminderDate ?? null,
        recurrence: data.recurrence ?? 'NONE',
        boardPosition: await appendTaskPosition(tx, data.status ?? 'TODO'),
      },
    });
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'TASK_CREATED',
      entityType: 'task',
      entityId: task.id,
      message: `Tarefa criada: ${task.title}`,
    });
    return task;
  });
  return { id: created.id };
}

export async function updateTask(
  id: string,
  data: Omit<TaskUpdate, 'id'>,
  actor: ActorContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockTaskBoard(tx);
    const existing = await visibleTask(tx, id, actor);

    // Recurring tasks need a dueDate so we know which day-of-month to
    // resurrect on. Validate the post-update state, not just the patch.
    const resultingRecurrence = data.recurrence ?? existing.recurrence;
    const resultingDueDate = data.dueDate !== undefined ? data.dueDate : existing.dueDate;
    if (resultingRecurrence !== 'NONE' && !resultingDueDate) {
      throw new TaskValidationError('Tarefas recorrentes precisam de uma data de prazo.');
    }

    const update: Prisma.TaskUpdateInput = { boardVersion: { increment: 1 } };
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description ?? null;
    if (data.priority !== undefined) update.priority = data.priority;
    if (data.assigneeId && !(await activeAssignee(tx, data.assigneeId))) {
      throw new TaskValidationError('Escolha um responsável ativo.');
    }
    if (data.assigneeId !== undefined) {
      update.assignee = data.assigneeId
        ? { connect: { id: data.assigneeId } }
        : { disconnect: true };
    }
    if (data.startDate !== undefined) update.startDate = data.startDate ?? null;
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ?? null;
    if (data.reminderDate !== undefined) update.reminderDate = data.reminderDate ?? null;
    if (data.recurrence !== undefined) update.recurrence = data.recurrence;

    const updated = await tx.task.update({ where: { id }, data: update });
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'TASK_STATUS_CHANGED',
      entityType: 'task',
      entityId: id,
      message: `Tarefa editada: ${updated.title}`,
    });
    if (data.status !== undefined && data.status !== updated.status) {
      await applyTaskStatus(
        tx,
        updated,
        data.status,
        actor,
        await appendTaskPosition(tx, data.status),
      );
    }
  });
}

/**
 * Status change handler. When a recurring task flips to DONE we spawn the
 * next occurrence as a separate TODO task with `dueDate` shifted forward by
 * one cycle. The original stays in DONE (and gets purged the next Sunday).
 *
 * The spawned task starts immediately in TODO but with a future `dueDate`,
 * which makes it "scheduled standby" — hidden from the board by default
 * (see `buildTaskWhere`'s standby filter) until the user toggles "show
 * scheduled" on. When `dueDate <= now`, the same task naturally becomes
 * visible — no separate resurrection job needed.
 */
async function applyTaskStatus(
  tx: Prisma.TransactionClient,
  existing: Task,
  nextStatus: TaskStatus,
  actor: ActorContext,
  boardPosition: Prisma.Decimal,
): Promise<{ spawnedTaskId: string | null; nextOccurrenceDate: string | null }> {
  const id = existing.id;
  if (existing.status === nextStatus) {
    await tx.task.update({
      where: { id },
      data: { boardPosition, boardVersion: { increment: 1 } },
    });
    return { spawnedTaskId: null, nextOccurrenceDate: null };
  }

  // Track when a task became DONE so the auto-purge can find it.
  // Clear when moving away from DONE so the retention boundary resets if it
  // ever lands back in DONE.
  const completedAt =
    nextStatus === 'DONE' && existing.status !== 'DONE'
      ? new Date()
      : nextStatus !== 'DONE' && existing.status === 'DONE'
        ? null
        : existing.completedAt;

  const updated = await tx.task.update({
    where: { id },
    data: { status: nextStatus, completedAt, boardPosition, boardVersion: { increment: 1 } },
  });

  let spawnedTaskId: string | null = null;
  let nextOccurrenceDate: string | null = null;

  const flippedToDone = nextStatus === 'DONE' && existing.status !== 'DONE';
  if (flippedToDone && existing.recurrence !== 'NONE') {
    const newDueDate = existing.dueDate
      ? shiftRecurrence(existing.dueDate, existing.recurrence)
      : null;
    const newStartDate = existing.startDate
      ? shiftRecurrence(existing.startDate, existing.recurrence)
      : null;
    const newReminderDate = existing.reminderDate
      ? shiftRecurrence(existing.reminderDate, existing.recurrence)
      : null;

    const spawned = await tx.task.create({
      data: {
        title: existing.title,
        description: existing.description,
        status: 'TODO',
        priority: existing.priority,
        assigneeId: existing.assigneeId,
        startDate: newStartDate,
        dueDate: newDueDate,
        reminderDate: newReminderDate,
        recurrence: existing.recurrence,
        recurrenceParentId: existing.id,
        boardPosition: await appendTaskPosition(tx, 'TODO'),
      },
    });
    spawnedTaskId = spawned.id;
    nextOccurrenceDate = newDueDate ? newDueDate.toISOString() : null;

    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'TASK_CREATED',
      entityType: 'task',
      entityId: spawned.id,
      message: nextOccurrenceDate
        ? `Próxima ocorrência agendada: ${spawned.title} (${nextOccurrenceDate.slice(0, 10)})`
        : `Próxima ocorrência agendada: ${spawned.title}`,
      metadata: { parentId: existing.id },
    });
  }

  await emitActivity(tx, {
    actorId: actor.actorId,
    type: flippedToDone ? 'TASK_COMPLETED' : 'TASK_STATUS_CHANGED',
    entityType: 'task',
    entityId: id,
    message: flippedToDone
      ? `Tarefa concluída: ${updated.title}`
      : `Estado alterado: ${existing.status} → ${nextStatus} (${updated.title})`,
    metadata: { from: existing.status, to: nextStatus },
  });

  return { spawnedTaskId, nextOccurrenceDate };
}

export async function changeTaskStatus(id: string, nextStatus: TaskStatus, actor: ActorContext) {
  return prisma.$transaction(async (tx) => {
    await lockTaskBoard(tx);
    const existing = await visibleTask(tx, id, actor);
    if (existing.status === nextStatus) return { spawnedTaskId: null, nextOccurrenceDate: null };
    return applyTaskStatus(
      tx,
      existing,
      nextStatus,
      actor,
      await appendTaskPosition(tx, nextStatus),
    );
  });
}

export async function moveTask(id: string, move: TaskMove, actor: ActorContext) {
  return prisma.$transaction(async (tx) => {
    await lockTaskBoard(tx);
    const existing = await visibleTask(tx, id, actor);
    if (existing.boardVersion !== move.expectedVersion) throw new TaskBoardConflict();
    const anchors: Task[] = [];
    for (const anchor of [move.before, move.after]) {
      if (!anchor) continue;
      if (anchor.id === id)
        throw new TaskValidationError('A tarefa não pode ser o seu próprio vizinho.');
      // Recheck visibility after acquiring the lock, including ownership changes.
      const neighbour = await visibleTask(tx, anchor.id, actor);
      if (neighbour.status !== move.status || neighbour.boardVersion !== anchor.version) {
        throw new TaskBoardConflict();
      }
      anchors.push(neighbour);
    }
    if (anchors.length === 2 && anchors[0]!.boardPosition.gte(anchors[1]!.boardPosition)) {
      throw new TaskBoardConflict();
    }
    const position = await movedTaskPosition(tx, id, move.status, move.before?.id, move.after?.id);
    const result = await applyTaskStatus(tx, existing, move.status, actor, position);
    return { ...result, boardVersion: existing.boardVersion + 1 };
  });
}

export async function deleteTask(id: string, actor: ActorContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockTaskBoard(tx);
    const existing = await visibleTask(tx, id, actor);
    await tx.task.delete({ where: { id } });
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'TASK_STATUS_CHANGED',
      entityType: 'task',
      entityId: id,
      message: `Tarefa eliminada: ${existing.title}`,
      metadata: { deleted: true },
    });
  });
}
