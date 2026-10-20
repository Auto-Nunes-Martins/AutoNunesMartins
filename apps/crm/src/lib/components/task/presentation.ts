import type { Priority, TaskStatus } from '@anm/types';

/** One priority scale for the board, dashboard and quick task form. */
export const TASK_PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Baixa', color: 'var(--color-priority-low)' },
  { value: 'MEDIUM', label: 'Média', color: 'var(--color-priority-medium)' },
  { value: 'HIGH', label: 'Alta', color: 'var(--color-priority-high)' },
  { value: 'URGENT', label: 'Urgente', color: 'var(--color-priority-urgent)' },
];

export function taskPriority(value: string) {
  return TASK_PRIORITIES.find((priority) => priority.value === value) ?? TASK_PRIORITIES[0]!;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em curso',
  DONE: 'Concluída',
};
