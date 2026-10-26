<script lang="ts">
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import { onDestroy, untrack, tick } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { Check, CheckSquare, ArrowUpRight, RotateCcw } from 'lucide-svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import { formatDate } from '$lib/utils/format';
  import type { TodayTaskRow } from '$lib/server/dashboard';
  import { taskPriority, TASK_STATUS_LABELS } from '$lib/components/task/presentation';

  let {
    items = [],
    currentUserId = null,
    pending = false,
  }: {
    items?: TodayTaskRow[];
    currentUserId?: string | null;
    pending?: boolean;
  } = $props();
  let rows = $state<TodayTaskRow[]>(untrack(() => items));
  let loading = $state(false);
  let loadError = $state('');
  let actionError = $state('');
  let announcement = $state('');
  let pendingId = $state<string | null>(null);
  let initialItems = untrack(() => items);
  let controller: AbortController | undefined;
  let destroyed = false;
  let content: HTMLDivElement;
  onDestroy(() => {
    destroyed = true;
    controller?.abort();
  });
  $effect(() => {
    if (items !== initialItems) {
      initialItems = items;
      if (!loading && !pendingId) rows = items;
    }
  });
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const groupIndex = (task: TodayTaskRow) =>
    task.isOverdue ? 0 : task.dueDate?.slice(0, 10) === dateKey ? 1 : 2;
  const ordered = $derived(
    rows
      .filter((task) => task.status !== 'DONE')
      .sort((a, b) => {
        const rank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (
          groupIndex(a) - groupIndex(b) ||
          (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
          (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
        );
      }),
  );
  const visible = $derived(ordered.slice(0, 4));
  const overdueCount = $derived(ordered.filter((task) => task.isOverdue).length);
  function dueLabel(task: TodayTaskRow) {
    if (!task.dueDate) return task.status === 'IN_PROGRESS' ? 'Em curso' : 'Sem prazo';
    const date =
      task.dueDate.slice(0, 10) === dateKey ? 'Hoje' : formatDate(task.dueDate).slice(0, 5);
    return task.isOverdue ? `Atraso · ${date}` : date;
  }
  const busy = $derived(pending || loading);

  async function refetch() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    loading = true;
    loadError = '';
    try {
      const res = await sessionFetch(crmPath('/api/today-tasks?scope=mine'), {
        signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Unable to load tasks');
      const data = (await res.json()) as { items?: TodayTaskRow[] };
      if (signal.aborted) return;
      rows = data.items ?? [];
    } catch {
      if (!signal.aborted) {
        loadError = 'Não foi possível consultar as tarefas atuais.';
      }
    } finally {
      if (!signal.aborted) loading = false;
    }
  }
  async function complete(task: TodayTaskRow) {
    if (
      pendingId ||
      busy ||
      !currentUserId ||
      (task.assignee && task.assignee.id !== currentUserId)
    )
      return;
    pendingId = task.id;
    actionError = '';
    announcement = '';
    try {
      const res = await sessionFetch(crmPath(`/tarefas/${task.id}/status`), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      });
      if (!res.ok) throw new Error('Unable to complete task');
      if (destroyed) return;
      // Remove only after server confirmation. Never replay the write on refresh failure.
      rows = rows.filter((row) => row.id !== task.id);
      announcement = `Tarefa concluída: ${task.title}`;
      await refetch();
      await invalidateAll().catch(() => {
        actionError =
          'Tarefa concluída. Atualize a página para consultar os restantes indicadores.';
      });
      await tick();
      content?.focus({ preventScroll: true });
    } catch {
      if (!destroyed)
        actionError = 'Não foi possível confirmar a conclusão. Consulte a tarefa antes de repetir.';
    } finally {
      if (!destroyed) pendingId = null;
    }
  }
</script>

<Panel>
  <PanelHeader icon={CheckSquare} title="Tarefas">
    {#snippet actions()}
      <button
        class="refresh-tasks"
        type="button"
        aria-label="Atualizar tarefas"
        title="Atualizar tarefas"
        disabled={busy || !!pendingId}
        onclick={() => void refetch()}
      >
        <RotateCcw size={14} aria-hidden="true" />
      </button>
    {/snippet}
  </PanelHeader>
  <div class="task-summary">
    <span>{busy ? 'A atualizar…' : `${ordered.length} por tratar`}</span>
    {#if !busy && overdueCount > 0}<span class="overdue-summary">{overdueCount} em atraso</span>
    {:else}<span>Minhas e gerais</span>{/if}
  </div>
  <div
    class="task-content"
    role="region"
    aria-label="Tarefas atuais · minhas e gerais"
    tabindex="-1"
    bind:this={content}
    aria-busy={busy}
  >
    {#if loadError}
      <div class="task-empty" role="status">
        <p>{loadError}</p>
        <button type="button" onclick={() => void refetch()}>Tentar novamente</button>
      </div>
    {:else if busy}
      <div role="status">
        <span class="sr-only">A carregar tarefas…</span>
        {#each Array(4) as _}
          <div class="task-item pending-row" aria-hidden="true">
            <span class="pending-copy"><span></span><span></span></span><span class="pending-check"
            ></span>
          </div>
        {/each}
      </div>
    {:else if !visible.length}
      <div class="task-empty">
        <CheckSquare size={24} aria-hidden="true" />
        <p class="empty-title">Sem tarefas a pedir atenção.</p>
        <p>As suas tarefas e as gerais estão em dia.</p>
      </div>
    {:else}
      <ul class="task-list">
        {#each visible as task (task.id)}
          {@const priority = taskPriority(task.priority)}
          {@const canComplete =
            !!currentUserId && (!task.assignee || task.assignee.id === currentUserId)}
          <li
            class="task-item"
            class:is-saving={pendingId === task.id}
            style:--task-priority={priority.color}
          >
            <a class="task-copy" href={crmPath(`/tarefas/${task.id}/editar`)} title={task.title}>
              <span class="task-title">{task.title}</span>
              <span
                class="task-meta"
                title={`${task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'} · ${task.assignee?.name ?? 'Geral'}`}
              >
                <span class="due" class:overdue={task.isOverdue}>{dueLabel(task)}</span>
                <span class="priority" style:color={priority.color}>{priority.label}</span>
              </span>
              <span class="task-owner">
                {task.assignee?.name ?? 'Geral'}
                {#if task.status === 'IN_PROGRESS' && task.dueDate}
                  <span class="meta-separator" aria-hidden="true">·</span><span
                    >{TASK_STATUS_LABELS.IN_PROGRESS}</span
                  >
                {/if}
              </span>
            </a>
            {#if canComplete}
              <button
                class="complete-task"
                type="button"
                disabled={!!pendingId}
                aria-label={`Concluir tarefa: ${task.title}`}
                title="Concluir tarefa"
                onclick={() => void complete(task)}
              >
                {#if pendingId === task.id}<span class="saving-spinner" aria-hidden="true"></span>
                {:else}<span class="check-target"><Check size={12} aria-hidden="true" /></span>{/if}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <footer class="task-footer">
    {#if ordered.length > visible.length}<span
        >{visible.length} de {ordered.length} nesta lista</span
      >{/if}
    <a class="all-tasks" href={crmPath('/tarefas')}
      >Ver todas <ArrowUpRight size={14} aria-hidden="true" /></a
    >
  </footer>
  {#if actionError}<p class="action-error" role="alert">{actionError}</p>{/if}
  <span class="sr-only" role="status" aria-live="polite">{announcement}</span>
</Panel>

<style>
  .all-tasks,
  .refresh-tasks {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 32px;
    color: var(--color-text-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .refresh-tasks {
    width: 32px;
    cursor: pointer;
  }
  .all-tasks:hover,
  .task-copy:hover .task-title,
  .refresh-tasks:hover {
    color: var(--color-text);
  }
  .task-content {
    padding: 12px;
    outline-offset: -2px;
  }
  .task-list {
    display: grid;
    gap: 8px;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 104px;
    padding: 12px;
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--task-priority, var(--color-border));
    border-radius: var(--radius-btn);
    background: color-mix(in srgb, var(--color-bg-2) 40%, transparent);
  }
  .task-item:last-child {
    border-bottom: 1px solid var(--color-border);
  }
  .task-copy {
    flex: 1;
    min-width: 0;
    text-decoration: none;
    color: var(--color-text);
  }
  .task-title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .task-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 18px;
  }
  .due {
    padding: 1px 7px;
    border-radius: 3px;
    background: var(--color-bg-2);
    color: var(--color-text);
  }
  .task-owner {
    display: block;
    margin-top: 5px;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 16px;
    overflow-wrap: anywhere;
  }
  .meta-separator {
    padding-inline: 4px;
    color: var(--color-text-faint);
  }
  .task-meta .overdue {
    color: var(--color-priority-urgent);
    background: color-mix(in srgb, var(--color-priority-urgent) 12%, transparent);
  }
  .priority {
    font-weight: 600;
  }
  .complete-task {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  .check-target {
    width: 24px;
    height: 24px;
    border: 1px solid var(--color-border-strong);
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .complete-task:hover .check-target {
    color: var(--color-text);
    border-color: var(--color-text-muted);
    background: var(--color-bg-2);
  }
  button:disabled {
    cursor: wait;
    opacity: 0.55;
  }
  .task-empty {
    min-height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 12px;
  }
  .task-empty p {
    margin: 0;
    max-width: 34ch;
    line-height: 1.6;
  }
  .task-empty .empty-title {
    color: var(--color-text);
    font-size: 15px;
    font-weight: 500;
  }
  .task-empty button {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    text-decoration: underline;
    text-underline-offset: 3px;
    color: var(--color-text);
  }
  .action-error {
    padding: 10px 16px;
    margin: 0;
    border-top: 1px solid var(--color-border);
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-red);
  }
  .task-summary,
  .task-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-inline: 16px;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }
  .task-summary {
    padding-block: 10px 0;
  }
  .overdue-summary {
    color: var(--color-priority-urgent);
  }
  .task-footer {
    min-height: 56px;
    border-top: 1px solid var(--color-border);
  }
  .task-footer > span {
    max-width: 24ch;
  }
  .all-tasks {
    min-height: 44px;
    color: var(--color-text);
    margin-left: auto;
  }
  .pending-copy {
    flex: 1;
    display: grid;
    gap: 7px;
  }
  .pending-copy > span {
    height: 12px;
    width: 80%;
    background: var(--color-bg-2);
    border-radius: 2px;
  }
  .pending-copy > span + span {
    height: 9px;
    width: 52%;
  }
  .pending-check {
    width: 18px;
    height: 18px;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    margin-inline: 11px;
  }
  .saving-spinner {
    height: 16px;
    width: 16px;
    border: 1.5px solid var(--color-border);
    border-top-color: var(--color-text-muted);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--color-text);
    outline-offset: 2px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .all-tasks,
    .refresh-tasks {
      min-height: 44px;
    }
    .refresh-tasks {
      min-width: 44px;
    }
    .task-item {
      padding-inline: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .saving-spinner {
      animation: none;
    }
  }
</style>
