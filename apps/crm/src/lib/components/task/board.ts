import type { TaskMove, TaskStatus } from '@anm/types';
import type { TaskDto } from '$lib/server/tasks';

export type TaskBoard = Record<TaskStatus, TaskDto[]>;
export const taskStatuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export function copyBoard(board: TaskBoard): TaskBoard {
  return { TODO: [...board.TODO], IN_PROGRESS: [...board.IN_PROGRESS], DONE: [...board.DONE] };
}

/** Remove the task from every column before inserting it, including DnD's source copy. */
export function moveTask(board: TaskBoard, task: TaskDto, status: TaskStatus): TaskBoard {
  const index = board[status].findIndex((item) => item.id === task.id);
  const next = copyBoard(board);
  for (const column of taskStatuses)
    next[column] = next[column].filter((item) => item.id !== task.id);
  next[status].splice(index < 0 ? next[status].length : index, 0, { ...task, status });
  return next;
}

export function taskColumn(board: TaskBoard, id: string): TaskStatus | undefined {
  return taskStatuses.find((status) => board[status].some((task) => task.id === id));
}

export function taskMovePayload(task: TaskDto, status: TaskStatus, board: TaskBoard): TaskMove {
  const items = board[status];
  const index = items.findIndex((item) => item.id === task.id);
  const anchor = (item: TaskDto | undefined) =>
    item ? { id: item.id, version: item.boardVersion } : null;
  return {
    status,
    expectedVersion: task.boardVersion,
    before: anchor(items[index - 1]),
    after: anchor(items[index + 1]),
  };
}
