<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { onDestroy, untrack } from 'svelte';
  import { Calendar, CheckSquare, Users } from 'lucide-svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import { formatDate } from '$lib/utils/format';
  import type { TodayTaskRow } from '$lib/server/dashboard';
  import type { TaskAssignee } from '$lib/server/tasks';
  import { taskPriority } from '$lib/components/task/presentation';

  interface Props {
    items: TodayTaskRow[];
    users?: TaskAssignee[];
    currentUserId?: string | null;
  }

  let { items, users = [], currentUserId = null }: Props = $props();

  type Scope =
    | { kind: 'mine' }
    | { kind: 'general' }
    | { kind: 'all' }
    | { kind: 'byUser'; assigneeId: string; name: string };

  let scope = $state<Scope>({ kind: 'mine' });
  let rows = $state<TodayTaskRow[]>(untrack(() => items));
  let loading = $state(false);
  let loadError = $state('');

  // Keep `rows` aligned with new props if the parent re-streams.
  let initialItemsRef = untrack(() => items);
  let loadedScope: Scope = { kind: 'mine' };
  let controller: AbortController | undefined;
  onDestroy(() => controller?.abort());
  $effect(() => {
    if (items !== initialItemsRef && scope.kind === 'mine' && !loading) {
      rows = items;
      initialItemsRef = items;
    }
  });

  async function refetch(next: Scope) {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    scope = next;
    loading = true;
    loadError = '';
    try {
      const qs = new URLSearchParams();
      if (next.kind === 'byUser') {
        qs.set('scope', 'byUser');
        qs.set('assigneeId', next.assigneeId);
      } else {
        qs.set('scope', next.kind);
      }
      const res = await fetch(crmPath(`/api/today-tasks?${qs.toString()}`), {
        headers: { accept: 'application/json' },
        signal,
      });
      if (!res.ok) throw new Error('Unable to load dashboard tasks');
      const data = (await res.json()) as { items?: TodayTaskRow[] };
      if (signal.aborted) return;
      rows = data.items ?? [];
      loadedScope = next;
    } catch {
      if (signal.aborted) return;
      scope = loadedScope;
      loadError = 'Não foi possível atualizar as tarefas. Tente selecionar o filtro novamente.';
    } finally {
      if (!signal.aborted) loading = false;
    }
  }

  // Hide the current user from the per-user list (they have "Minhas")
  // and unassigned rows (the system has no name).
  const userOptions = $derived(users.filter((u) => u.id !== currentUserId && Boolean(u.name)));

  // Build today's date label in the prototype's "QUI · 30 ABR · N ATIVAS" format.
  const PT_WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const PT_MONTHS = [
    'JAN',
    'FEV',
    'MAR',
    'ABR',
    'MAI',
    'JUN',
    'JUL',
    'AGO',
    'SET',
    'OUT',
    'NOV',
    'DEZ',
  ];
  const todayLabel = $derived.by(() => {
    const d = new Date();
    return `${PT_WEEKDAYS[d.getDay()]} · ${d.getDate()} ${PT_MONTHS[d.getMonth()]} · ${rows.length} ATIVAS`;
  });
</script>

<Panel>
  <PanelHeader
    variant="dashboard"
    icon={CheckSquare}
    iconClass="text-[var(--color-info)]"
    title="Tarefas · Hoje"
    meta={todayLabel}
  >
    {#snippet actions()}
      <label class="task-scope">
        <Users class="h-3 w-3" />
        <span class="sr-only">Filtrar tarefas por responsável</span>
        <select
          aria-label="Filtrar tarefas por responsável"
          aria-busy={loading}
          value={scope.kind === 'byUser' ? scope.assigneeId : scope.kind}
          onchange={(event) => {
            const value = event.currentTarget.value;
            const user = userOptions.find((option) => option.id === value);
            if (user) refetch({ kind: 'byUser', assigneeId: user.id, name: user.name });
            else if (value === 'mine' || value === 'general' || value === 'all')
              refetch({ kind: value });
          }}
        >
          <option value="mine">Minhas</option>
          <option value="general">Geral · Sem responsável</option>
          <option value="all">Todas</option>
          {#if userOptions.length > 0}
            <optgroup label="Por utilizador">
              {#each userOptions as user (user.id)}<option value={user.id}>{user.name}</option
                >{/each}
            </optgroup>
          {/if}
        </select>
      </label>
    {/snippet}
  </PanelHeader>

  {#if loadError}
    <p role="status" class="px-5 pt-4 text-[12px] text-[var(--color-red)]">{loadError}</p>
  {/if}

  {#if loading}
    <div
      class="p-6 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
    >
      A carregar…
    </div>
  {:else if rows.length === 0}
    <div
      class="p-8 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
    >
      Sem tarefas para hoje
    </div>
  {:else}
    <ul class="task-list">
      {#each rows as t (t.id)}
        {@const priority = taskPriority(t.priority)}
        <li>
          <a href={crmPath(`/tarefas/${t.id}/editar`)} class="task-row group">
            <div class="priority-mark" aria-hidden="true">
              <strong style:color={priority.color}
                >{(
                  { URGENT: 'URG', HIGH: 'ALT', MEDIUM: 'MED', LOW: 'BXA' } as Record<
                    string,
                    string
                  >
                )[t.priority] ?? '—'}</strong
              >
              <span>{t.isOverdue ? 'Atraso' : 'Hoje'}</span>
            </div>
            <span class="task-divider" aria-hidden="true"></span>
            <div class="task-body">
              <div class="task-heading">
                <span class="task-title">{t.title}</span>
                <span class="priority" style:color={priority.color}>{priority.label}</span>
              </div>
              <div class="task-details">
                {#if t.isOverdue}<span class="overdue">Em atraso</span>{/if}
                {#if t.dueDate}
                  <span class="task-date"><Calendar class="h-3 w-3" />{formatDate(t.dueDate)}</span>
                {:else}<span>Sem prazo</span>{/if}
                <span class="assignee"
                  ><Users class="h-3 w-3" />{t.assignee?.name ?? 'Geral · Sem responsável'}</span
                >
              </div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</Panel>

<style>
  .task-scope {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
  }
  .task-scope select {
    max-width: 170px;
    height: 32px;
    padding: 0 8px;
    background: var(--color-bg-1);
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    font-family: var(--font-mono);
    font-size: 10px;
    cursor: pointer;
  }
  .task-scope select:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 2px;
  }
  .task-scope select:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .task-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .task-list li + li {
    border-top: 1px solid var(--color-border);
  }
  .task-row {
    display: grid;
    grid-template-columns: 48px 1.5px minmax(0, 1fr);
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    transition: background 0.15s;
  }
  .priority-mark {
    text-align: right;
  }
  .priority-mark strong {
    display: block;
    font-family: var(--font-display);
    font-size: 22px;
    font-style: italic;
    font-weight: 800;
    line-height: 1;
  }
  .priority-mark > span {
    display: block;
    margin-top: 5px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .task-divider {
    height: 34px;
    background: var(--color-red);
  }
  .task-row:hover {
    background: color-mix(in oklab, var(--color-text) 3%, transparent);
  }
  .task-row:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: -3px;
  }
  .task-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .task-title {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .priority {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 3px 6px;
    border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    border-radius: 3px;
    line-height: 1.4;
  }
  .task-details {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 12px;
    margin-top: 8px;
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.5;
  }
  .task-date,
  .assignee {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .task-date {
    font-family: var(--font-mono);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .overdue {
    color: var(--color-red);
    font-weight: 600;
  }
  @media (max-width: 640px) {
    .task-row {
      grid-template-columns: 40px 1.5px minmax(0, 1fr);
      gap: 10px;
      padding: 16px;
    }
    .task-heading {
      flex-wrap: wrap;
      gap: 6px;
    }
  }
</style>
