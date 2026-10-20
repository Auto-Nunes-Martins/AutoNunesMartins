<script lang="ts">
  import { Calendar, CalendarClock, GripVertical, RotateCw, X } from 'lucide-svelte';
  import { crmPath } from '$lib/paths';
  import { formatDate } from '$lib/utils/format';
  import { taskPriority, TASK_STATUS_LABELS } from './presentation';
  import type { TaskDto } from '$lib/server/tasks';
  import type { Recurrence, TaskStatus } from '@anm/types';

  let {
    task,
    standby = false,
    pending = false,
    disabled = false,
    ondelete,
    onstatuschange,
  }: {
    task: TaskDto;
    standby?: boolean;
    pending?: boolean;
    disabled?: boolean;
    ondelete?: () => void;
    onstatuschange?: (status: TaskStatus) => void;
  } = $props();

  const priority = $derived(taskPriority(task.priority));
  const recurrenceLabels: Record<Recurrence, string> = {
    NONE: '',
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensal',
    ANNUAL: 'Anual',
  };
  const initials = $derived(
    (task.assignee?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join(''),
  );
  const overdue = $derived(
    Boolean(
      task.dueDate &&
      task.status !== 'DONE' &&
      new Date(task.dueDate) < new Date(new Date().toISOString().slice(0, 10)),
    ),
  );

  // Native controls retain their own pointer and keyboard behavior inside the draggable wrapper.
  function preventDrag(node: HTMLElement) {
    const stop = (event: Event) => event.stopPropagation();
    node.addEventListener('mousedown', stop);
    node.addEventListener('touchstart', stop, { passive: true });
    node.addEventListener('keydown', stop);
    return {
      destroy() {
        node.removeEventListener('mousedown', stop);
        node.removeEventListener('touchstart', stop);
        node.removeEventListener('keydown', stop);
      },
    };
  }
</script>

<article
  class="task-card"
  class:is-standby={standby}
  class:is-pending={pending}
  aria-busy={pending}
  style:--priority={priority.color}
  style:--task-status={task.status === 'DONE'
    ? 'var(--color-success)'
    : task.status === 'IN_PROGRESS'
      ? 'var(--color-info)'
      : 'var(--color-text-muted)'}
>
  <div class="card-heading">
    <h4><a href={crmPath(`/tarefas/${task.id}/editar`)} use:preventDrag>{task.title}</a></h4>
    {#if !standby}<GripVertical class="drag-grip" aria-hidden="true" />{/if}
    {#if standby && ondelete}
      <button
        class="cancel-btn"
        type="button"
        use:preventDrag
        onclick={ondelete}
        {disabled}
        aria-label={`Cancelar próxima ocorrência: ${task.title}`}
        title="Cancelar próxima ocorrência"><X size={15} /></button
      >
    {/if}
  </div>
  {#if task.description}<p class="description">{task.description}</p>{/if}
  <div class="card-meta">
    <span class="priority">{priority.label}</span>
    {#if task.recurrence !== 'NONE'}<span class="recurrence"
        ><RotateCw size={12} />{recurrenceLabels[task.recurrence]}</span
      >{/if}
    {#if task.dueDate}
      <span class="due" class:overdue>
        {#if standby}<CalendarClock size={13} />{:else}<Calendar size={13} />{/if}
        {standby ? 'Agendada · ' : overdue ? 'Em atraso · ' : ''}{formatDate(task.dueDate)}
      </span>
    {/if}
  </div>
  <div class="card-footer">
    {#if onstatuschange && !standby}
      <label class="status-control" use:preventDrag>
        <span class="sr-only">Estado de {task.title}</span>
        <select
          value={task.status}
          disabled={disabled || pending}
          onchange={(event) => onstatuschange?.(event.currentTarget.value as TaskStatus)}
        >
          {#each Object.entries(TASK_STATUS_LABELS) as [value, label]}<option {value}
              >{label}</option
            >{/each}
        </select>
      </label>
    {:else}<span class="scheduled-label">Próxima ocorrência</span>{/if}
    <span class="assignee" title={task.assignee?.name ?? 'Geral · Sem responsável'}>
      {#if task.assignee?.imageUrl}
        <img
          src={task.assignee.imageUrl}
          alt={task.assignee.name}
          referrerpolicy="no-referrer"
          loading="lazy"
        />
      {:else if task.assignee}
        <span class="initials" aria-label={task.assignee.name}>{initials || 'A'}</span>
      {:else}<span>Geral</span>{/if}
    </span>
  </div>
</article>

<style>
  .task-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-border);
    border-left: 4px solid var(--priority);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
    cursor: grab;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;
  }
  .task-card:hover {
    border-top-color: var(--color-border-strong);
    border-right-color: var(--color-border-strong);
    border-bottom-color: var(--color-border-strong);
  }
  .card-heading {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  h4 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  h4 a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  :global(.drag-grip) {
    width: 16px;
    height: 20px;
    flex-shrink: 0;
    color: var(--color-text-faint);
    opacity: 0.65;
  }
  .description {
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--color-text-muted);
    font-size: 12px;
    line-height: 1.55;
  }
  .card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 10px;
    color: var(--color-text-muted);
    font-size: 11px;
  }
  .priority {
    padding: 2px 6px;
    font-weight: 600;
    color: var(--priority);
    border: 1px solid color-mix(in srgb, var(--priority) 45%, transparent);
    border-radius: 3px;
    background: color-mix(in srgb, var(--priority) 12%, transparent);
  }
  .recurrence,
  .due {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .due {
    font-variant-numeric: tabular-nums;
  }
  .overdue {
    color: var(--color-priority-urgent);
  }
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    border-top: 1px solid var(--color-border);
    padding-top: 10px;
  }
  .status-control select {
    max-width: 100%;
    min-height: 32px;
    padding: 4px 22px 4px 7px;
    font-size: 11px;
    color: var(--task-status);
    background: color-mix(in srgb, var(--task-status) 8%, var(--color-bg-1));
    border: 1px solid color-mix(in srgb, var(--task-status) 35%, transparent);
    border-radius: var(--radius-btn);
  }
  .status-control select:disabled {
    opacity: 0.65;
  }
  .assignee {
    display: inline-flex;
    align-items: center;
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .assignee img,
  .initials {
    height: 28px;
    width: 28px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    object-fit: cover;
  }
  .initials {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    background: var(--color-bg-3);
  }
  .is-standby {
    cursor: default;
    border-style: dashed;
    background: var(--color-bg-2);
  }
  .cancel-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
  }
  .cancel-btn:hover {
    color: var(--color-priority-urgent);
    border-color: currentColor;
  }
  .scheduled-label {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .is-pending {
    cursor: wait;
  }
  @media (pointer: coarse) {
    .status-control select,
    .cancel-btn {
      min-height: 44px;
    }
    .cancel-btn {
      width: 44px;
    }
  }
</style>
