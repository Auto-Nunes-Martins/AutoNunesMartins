<script lang="ts">
  import TaskChoiceFilters from '$lib/components/task/TaskChoiceFilters.svelte';
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import { tick, untrack } from 'svelte';
  import { CalendarClock, Plus, Search, X } from 'lucide-svelte';
  import { invalidateAll } from '$app/navigation';
  import { filterNavigation } from '$lib/filterNavigation';
  import { page } from '$app/stores';
  import {
    dndzone,
    SOURCES,
    TRIGGERS,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    type DndEvent,
  } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { toast } from 'svelte-sonner';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import ExportMenu from '$lib/components/common/ExportMenu.svelte';
  import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
  import RecentActivityFeed from '$lib/components/dashboard/RecentActivityFeed.svelte';
  import TaskCard from '$lib/components/task/TaskCard.svelte';
  import { TASK_STATUS_LABELS } from '$lib/components/task/presentation';
  import {
    copyBoard,
    moveTask,
    taskColumn,
    taskMovePayload,
    type TaskBoard,
  } from '$lib/components/task/board';
  import { reducedMotion } from '$lib/stores/reducedMotion';
  import { formatDate, formatDateLong } from '$lib/utils/format';
  import type { TaskDto } from '$lib/server/tasks';
  import type { Priority, TaskStatus } from '@anm/types';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  const navigation = filterNavigation(() => $page.url);
  const today = new Date();

  const COLUMN_DEFS: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'TODO', label: 'A Fazer', color: 'var(--color-text-faint)' },
    { status: 'IN_PROGRESS', label: 'Em Curso', color: 'var(--color-info)' },
    { status: 'DONE', label: 'Concluído', color: 'var(--color-success)' },
  ];

  // Local mutable copy of active (non-standby) tasks so DnD can update
  // positions optimistically.
  let board = $state<Record<TaskStatus, TaskDto[]>>({
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  });

  // Scheduled (standby) tasks live alongside the board but outside the
  // dndzone — they're not draggable. Only shown when the user toggled the
  // "Tarefas agendadas" filter on (otherwise the backend filters them out).
  let standbyTasks = $state<TaskDto[]>([]);

  // A recurring task in TODO with a future dueDate is "scheduled" — already
  // spawned by a previous completion but not yet active.
  function isStandby(t: TaskDto): boolean {
    if (t.status !== 'TODO' || t.recurrence === 'NONE' || !t.dueDate) return false;
    return new Date(t.dueDate) > new Date();
  }

  let dragStart = $state<TaskBoard | null>(null);
  let pendingId = $state<string | null>(null);
  let needsVerification = $state(false);
  let boardMessage = $state('');
  let boardElement: HTMLDivElement | undefined;
  let cancelKeyboardDrag = false;
  const duration = $derived($reducedMotion ? 0 : 160);
  const locked = $derived(Boolean(pendingId || needsVerification));

  function syncBoard(tasks: TaskDto[]) {
    const next: Record<TaskStatus, TaskDto[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    const standby: TaskDto[] = [];
    for (const t of tasks) {
      if (isStandby(t)) standby.push(t);
      else next[t.status].push(t);
    }
    board = next;
    standbyTasks = standby;
  }

  $effect(() => {
    const tasks = data.tasks;
    // A background refresh must not replace the shadow item during a drag.
    untrack(() => {
      if (!dragStart && !pendingId && !needsVerification) syncBoard(tasks);
    });
  });

  async function restoreFocus(id: string, statusControl = false) {
    await tick();
    const item = [...(boardElement?.querySelectorAll<HTMLElement>('[data-task-id]') ?? [])].find(
      (node) => node.dataset.taskId === id,
    );
    ((statusControl ? item?.querySelector('select') : item) ?? boardElement)?.focus({
      preventScroll: true,
    });
  }

  async function refreshBoard() {
    await invalidateAll();
    if (data.error) throw new Error(data.error);
    syncBoard(data.tasks);
  }

  async function verifyBoard() {
    try {
      await refreshBoard();
      needsVerification = false;
      boardMessage = 'Quadro atualizado com os dados guardados.';
    } catch {
      boardMessage =
        'Estado por confirmar. Verifique a ligação e atualize o quadro antes de voltar a mover tarefas.';
    }
  }

  async function persistMove(
    task: TaskDto,
    status: TaskStatus,
    previous: TaskBoard,
    statusControl = false,
  ) {
    if (locked) return;
    pendingId = task.id;
    boardMessage = 'A guardar a posição da tarefa…';
    board = moveTask(board, task, status);
    if (statusControl) mobileColumn = status;
    let rejected = false;
    let conflict = false;
    let saved = false;
    try {
      const res = await sessionFetch(crmPath(`/tarefas/${task.id}/move`), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(taskMovePayload(task, status, board)),
      });
      // A 4xx is a known rejection. A network/5xx failure can arrive after a commit.
      rejected = res.status >= 400 && res.status < 500;
      conflict = res.status === 409 || res.status === 404;
      if (!res.ok) throw new Error('Não foi possível guardar o estado.');
      saved = true;
      const result = (await res.json().catch(() => ({}))) as {
        spawnedTaskId: string | null;
        nextOccurrenceDate: string | null;
        boardVersion: number;
      };
      board = {
        ...board,
        [status]: board[status].map((item) =>
          item.id === task.id
            ? { ...item, boardVersion: result.boardVersion ?? task.boardVersion + 1 }
            : item,
        ),
      };
      boardMessage =
        task.status === status
          ? 'Ordem guardada.'
          : `Estado e posição guardados: ${TASK_STATUS_LABELS[status].toLowerCase()}.`;
      if (result.spawnedTaskId && result.nextOccurrenceDate) {
        boardMessage = `Tarefa concluída. Próxima ocorrência agendada para ${formatDate(result.nextOccurrenceDate)}.`;
      }
      toast.success(boardMessage);
      try {
        await refreshBoard();
      } catch {
        boardMessage = 'Alteração guardada. Não foi possível atualizar o restante quadro.';
      }
    } catch {
      if (rejected) {
        board = previous;
        if (statusControl) mobileColumn = task.status;
        boardMessage = 'A alteração foi recusada. A tarefa voltou ao estado anterior.';
        toast.error(boardMessage);
        if (conflict) {
          needsVerification = true;
          await verifyBoard();
          if (!needsVerification)
            boardMessage = 'O quadro mudou entretanto e foi atualizado. Volte a mover a tarefa.';
        }
      } else if (!saved) {
        needsVerification = true;
        boardMessage = 'A resposta não chegou. A verificar o estado guardado…';
        await verifyBoard();
      }
    } finally {
      pendingId = null;
      await restoreFocus(task.id, statusControl);
    }
  }

  function commitDrag(id: string) {
    const previous = dragStart;
    dragStart = null;
    if (!previous) return;
    const originalColumn = taskColumn(previous, id);
    const targetColumn = taskColumn(board, id);
    const task = originalColumn && previous[originalColumn].find((item) => item.id === id);
    const originalIndex = originalColumn
      ? previous[originalColumn].findIndex((item) => item.id === id)
      : -1;
    const targetIndex = targetColumn ? board[targetColumn].findIndex((item) => item.id === id) : -1;
    if (task && targetColumn && (targetColumn !== originalColumn || targetIndex !== originalIndex))
      void persistMove(task, targetColumn, previous);
    else {
      boardMessage = 'A tarefa manteve a posição.';
      void restoreFocus(id);
    }
  }

  function consider(status: TaskStatus, event: CustomEvent<DndEvent<TaskDto>>) {
    const { items, info } = event.detail;
    if (info.trigger === TRIGGERS.DRAG_STARTED) {
      cancelKeyboardDrag = false;
      dragStart = copyBoard(board);
      boardMessage =
        'A mover tarefa. Use as setas para ordenar, Tab para mudar de coluna e Espaço para largar.';
    }
    board = { ...board, [status]: items };
    if (info.trigger === TRIGGERS.DRAG_STOPPED) {
      if (cancelKeyboardDrag && dragStart) {
        board = dragStart;
        dragStart = null;
        boardMessage = 'Movimento cancelado.';
        void restoreFocus(String(info.id));
      } else commitDrag(String(info.id));
    }
  }

  function finalize(status: TaskStatus, event: CustomEvent<DndEvent<TaskDto>>) {
    const { items, info } = event.detail;
    board = { ...board, [status]: items };
    if (info.source === SOURCES.KEYBOARD || info.trigger === TRIGGERS.DROPPED_INTO_ANOTHER) return;
    if (info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY && dragStart) {
      board = dragStart;
      dragStart = null;
      boardMessage = 'Movimento cancelado.';
      void restoreFocus(String(info.id));
    } else commitDrag(String(info.id));
  }
  // Modal state for cancelling a scheduled standby occurrence via the X
  // button on its card. Deleting a standby task means the recurrence chain
  // stops — no new instance will be spawned until the user completes
  // another recurring task of the same kind.
  let pendingCancel = $state<TaskDto | null>(null);
  let cancelling = $state(false);

  function requestCancel(task: TaskDto) {
    pendingCancel = task;
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    const target = pendingCancel;
    cancelling = true;
    try {
      const res = await sessionFetch(crmPath(`/tarefas/${target.id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Drop locally for instant feedback, then revalidate.
      standbyTasks = standbyTasks.filter((t) => t.id !== target.id);
      toast.success('Próxima ocorrência cancelada.');
      pendingCancel = null;
      await invalidateAll();
    } catch (err) {
      toast.error(`Falha ao cancelar: ${(err as Error).message}`);
    } finally {
      cancelling = false;
    }
  }

  type Scope = 'all' | 'mine' | 'general';

  function setPriority(value: Priority | undefined) {
    navigation.set('priority', value);
  }

  function setScope(value: Scope) {
    navigation.set('scope', value === 'all' ? undefined : value);
  }

  function setSearch(value: string) {
    navigation.set('q', value, true);
  }

  function toggleShowScheduled() {
    navigation.set('showScheduled', showScheduledActive ? undefined : 'true');
  }

  const currentScope = $derived<Scope>(data.filters.scope ?? 'all');
  const showScheduledActive = $derived(Boolean(data.filters.showScheduled));
  const hasFilters = $derived(
    Boolean(
      data.filters.attention ||
      data.filters.priority ||
      currentScope !== 'all' ||
      data.filters.q ||
      showScheduledActive,
    ),
  );

  function clearFilters() {
    navigation.clear();
  }

  // Mobile: which column is currently shown. The segmented control above
  // the board toggles it. Desktop renders all three columns in a grid
  // regardless of this value.
  let mobileColumn = $state<TaskStatus>('TODO');
</script>

<svelte:head>
  <title>Tarefas · Auto Nunes Martins</title>
</svelte:head>

<section class="pt-8 pb-12 space-y-6">
  <!-- Page header -->
  <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
    <div class="min-w-0">
      <ItalicHero text="Tarefas" size="lg" />
      <div
        class="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-[var(--color-red)]"></span>
        {formatDateLong(today)}
        <span class="text-[var(--color-text-faint)]">·</span>
        <span class="tabular-nums">{data.tasks.length} no quadro</span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <!-- Export menu with explicit CSV or PDF selection and no default. -->
      <div class="hidden md:inline-flex">
        <ExportMenu baseHref={crmPath('/tarefas/export')} extraQuery={$page.url.search} />
      </div>
      <a
        href={crmPath('/tarefas/nova')}
        class="inline-flex md:hidden items-center justify-center h-11 w-11 text-white bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] transition-colors"
        style="border-radius: var(--radius-btn);"
        aria-label="Nova tarefa"
      >
        <Plus class="h-4 w-4" />
      </a>
      <div class="hidden md:inline-flex">
        <Button variant="primary" size="md" href={crmPath('/tarefas/nova')}>
          <Plus class="h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <Panel>
    <fieldset class="p-4 space-y-3" disabled={locked || Boolean(dragStart)}>
      <legend class="sr-only">Filtrar tarefas</legend>
      <div class="flex items-center gap-3">
        <div
          class="flex-1 relative flex items-center h-11 px-3 border border-[var(--color-border)] bg-[var(--color-bg-1)] focus-within:border-[var(--color-red)] transition-colors"
          style="border-radius: var(--radius-btn);"
        >
          <Search class="h-4 w-4 text-[var(--color-text-faint)]" />
          <input
            type="search"
            aria-label="Pesquisar tarefas"
            placeholder="Pesquisar tarefas…"
            value={data.filters.q ?? ''}
            oninput={(e) => setSearch(e.currentTarget.value)}
            onkeydown={(e) => {
              if (e.key === 'Enter') navigation.flush();
            }}
            class="min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--color-text-faint)]"
          />
        </div>
        {#if hasFilters}
          <button
            type="button"
            onclick={clearFilters}
            class="inline-flex items-center gap-1.5 px-3 h-11 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors"
          >
            <X class="h-3 w-3" /> Limpar
          </button>
        {/if}
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label class="text-[12px] text-[var(--color-text-muted)]"
          >Mostrar
          <select
            class="ml-2 h-9 px-3 border border-[var(--color-border)] bg-[var(--color-bg-1)] text-[var(--color-text)]"
            value={data.filters.attention ?? ''}
            onchange={(event) => {
              navigation.set('attention', event.currentTarget.value);
            }}
            ><option value="">Todas as tarefas</option><option value="due"
              >Prazo de hoje ou em atraso</option
            ><option value="reminders">Lembretes de hoje</option></select
          >
        </label>
      </div>
      <TaskChoiceFilters
        priority={data.filters.priority}
        scope={currentScope}
        showScheduled={showScheduledActive}
        onpriority={setPriority}
        onscope={setScope}
        onscheduled={toggleShowScheduled}
      />
    </fieldset>
  </Panel>

  {#if data.error}
    <Panel>
      <div
        class="p-4 flex flex-wrap items-center gap-3 text-[var(--color-red)] text-[13px]"
        role="alert"
      >
        <strong class="font-mono uppercase tracking-[0.12em] text-[10px]">Erro</strong>
        <span>{data.error}</span>
        <Button variant="outline" size="sm" onclick={verifyBoard}>Tentar novamente</Button>
      </div>
    </Panel>
  {/if}

  <!--
    Mobile segmented control. Below md the board shows one column at a time;
    this strip picks which one. Active state uses the column's own color for
    the dot + a brand-red top rail so it reads as part of the same DNA as
    the sidebar's left-rail active state.
  -->
  <div class="md:hidden">
    <div
      class="grid grid-cols-3 border border-[var(--color-border)] overflow-hidden"
      style="border-radius: var(--radius-card); background: var(--color-bg-1);"
      role="group"
      aria-label="Estado da tarefa"
    >
      {#each COLUMN_DEFS as col (col.status)}
        {@const active = mobileColumn === col.status}
        <button
          type="button"
          aria-pressed={active}
          onclick={() => (mobileColumn = col.status)}
          class="tab-pill {active ? 'is-active' : ''}"
        >
          <span class="flex items-center justify-center gap-1.5">
            <span class="h-2 w-2 rounded-full flex-shrink-0" style="background: {col.color};"
            ></span>
            <span class="font-mono text-[10px] uppercase tracking-[0.15em]">{col.label}</span>
          </span>
          <span class="font-mono text-[10px] tabular-nums opacity-70 mt-0.5">
            {board[col.status].length}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Kanban -->
  <div class="board-feedback">
    <p id="board-instructions">
      A ordem fica guardada; nas tarefas gerais é partilhada. Teclado: Espaço para mover, setas para
      ordenar, Tab para mudar de coluna, Espaço para largar e Esc para cancelar.
    </p>
    <p role="status" aria-live="polite">{boardMessage}</p>
    {#if needsVerification}<Button
        variant="outline"
        size="sm"
        disabled={Boolean(pendingId)}
        onclick={verifyBoard}>Verificar estado guardado</Button
      >{/if}
  </div>
  <div
    class="grid grid-cols-1 md:grid-cols-3 gap-4"
    bind:this={boardElement}
    tabindex="-1"
    role="region"
    aria-label="Quadro de tarefas"
    onkeydowncapture={(event) => {
      if (event.key === 'Escape' && dragStart) cancelKeyboardDrag = true;
    }}
  >
    {#each COLUMN_DEFS as col (col.status)}
      <div class={col.status === mobileColumn ? 'block' : 'hidden md:block'}>
        <Panel>
          <header
            class="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]"
          >
            <div class="flex items-center gap-2.5">
              <span class="h-2 w-2 rounded-full flex-shrink-0" style="background: {col.color};"
              ></span>
              <div class="h-[18px] w-[1.5px]" style="background: {col.color};"></div>
              <h3 class="font-display text-[16px] font-bold italic uppercase tracking-[-0.01em]">
                {col.label}
              </h3>
              {#if col.status === 'DONE'}
                <span
                  class="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] ml-1"
                  title="A limpeza semanal elimina tarefas concluídas antes do último Domingo. Tarefas sem data de conclusão são preservadas."
                >
                  · limpa Dom
                </span>
              {/if}
            </div>
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] tabular-nums"
            >
              {board[col.status].length}
            </span>
          </header>

          <div class="board-column">
            <div
              aria-label={col.label}
              aria-describedby="board-instructions"
              data-task-column={col.status}
              use:dndzone={{
                items: board[col.status],
                flipDurationMs: duration,
                dropAnimationDisabled: $reducedMotion,
                dragDisabled: locked,
                dropFromOthersDisabled: locked,
                delayTouchStart: 180,
                type: 'task',
                dropTargetStyle: {
                  outline: '2px solid var(--color-text-muted)',
                  outlineOffset: '-2px',
                },
              }}
              onconsider={(e: CustomEvent<DndEvent<TaskDto>>) => consider(col.status, e)}
              onfinalize={(e: CustomEvent<DndEvent<TaskDto>>) => finalize(col.status, e)}
              class="task-zone p-3 min-h-[200px]"
            >
              {#each board[col.status] as t (t.id)}
                <div
                  animate:flip={{ duration }}
                  data-task-id={t.id}
                  aria-label={t.title}
                  class:drag-shadow={Boolean(
                    (t as TaskDto & Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME],
                  )}
                >
                  <TaskCard
                    task={t}
                    pending={pendingId === t.id}
                    disabled={locked || Boolean(dragStart)}
                    onstatuschange={(status) => persistMove(t, status, copyBoard(board), true)}
                  />
                </div>
              {/each}
            </div>
            {#if board[col.status].length === 0 && !(col.status === 'TODO' && standbyTasks.length > 0)}
              <div class="empty-column" aria-hidden="true">
                {data.error
                  ? 'Quadro indisponível'
                  : dragStart
                    ? 'Largar aqui'
                    : hasFilters
                      ? 'Sem tarefas para estes filtros'
                      : 'Sem tarefas'}
              </div>
            {/if}
          </div>

          {#if col.status === 'TODO' && standbyTasks.length > 0}
            <!--
            Standby strip: scheduled recurring tasks that haven't reached
            their dueDate yet. Outside the dndzone above so they cannot be
            dragged. The X on each card cancels the upcoming occurrence.
          -->
            <div
              class="px-3 pb-3 pt-1 border-t border-dashed border-[var(--color-border)] space-y-2.5"
            >
              <div class="flex items-center gap-1.5 pt-1 pb-0.5">
                <span class="h-1 w-1 rounded-full bg-[var(--color-text-faint)]"></span>
                <span
                  class="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
                >
                  Agendadas · {standbyTasks.length}
                </span>
              </div>
              {#each standbyTasks as t (t.id)}
                <TaskCard
                  task={t}
                  standby
                  disabled={locked || cancelling}
                  ondelete={() => requestCancel(t)}
                />
              {/each}
            </div>
          {/if}
        </Panel>
      </div>
    {/each}
  </div>

  <!--
    Task activity feed — created / status-changed / completed. Lives at the
    end of the page so the kanban stays the visual primary while still giving
    users a quick log of the latest moves. Extra top spacing puts visible
    breathing room between the board and the log.
  -->
  <div class="mt-8">
    <RecentActivityFeed items={data.taskActivity} title="Atividade de Tarefas" />
  </div>
</section>

<ConfirmDialog
  open={pendingCancel !== null}
  title="Cancelar próxima ocorrência?"
  message={pendingCancel
    ? `A tarefa "${pendingCancel.title}" agendada para ${pendingCancel.dueDate ? formatDate(pendingCancel.dueDate) : '—'} será eliminada. Não voltará a ser criada automaticamente — para retomar, terás de criar a tarefa de novo.`
    : ''}
  confirmLabel="Cancelar ocorrência"
  cancelLabel="Voltar"
  tone="danger"
  busy={cancelling}
  onconfirm={confirmCancel}
  oncancel={() => (pendingCancel = null)}
/>

<style>
  .board-feedback {
    color: var(--color-text-muted);
    font-size: 12px;
  }
  .board-feedback p {
    margin: 0;
  }
  .board-feedback [role='status'] {
    min-height: 20px;
    margin-top: 6px;
  }
  .board-column {
    position: relative;
  }
  .task-zone {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .task-zone > div {
    border-radius: var(--radius-card);
  }
  .task-zone > div:focus-visible {
    outline: 2px solid var(--color-text-muted);
    outline-offset: 3px;
  }
  .empty-column {
    position: absolute;
    inset: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-card);
    color: var(--color-text-muted);
    font-size: 12px;
    text-align: center;
    pointer-events: none;
  }
  .drag-shadow {
    opacity: 0.3;
  }
  /*
    Segmented-control button. Mirrors the brand language: mono uppercase
    label + red top rail when active (matching the sidebar's left-rail
    active state and the bottom-nav's top-rail active state).
  */
  .tab-pill {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px 6px;
    color: var(--color-text-muted);
    background: transparent;
    border: 0;
    border-right: 1px solid var(--color-border);
    cursor: pointer;
    transition:
      color 0.12s,
      background-color 0.12s;
  }
  .tab-pill:last-child {
    border-right: 0;
  }
  .tab-pill:hover {
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.02);
  }
  :global([data-theme='light']) .tab-pill:hover {
    background: rgba(0, 0, 0, 0.02);
  }
  .tab-pill.is-active {
    color: var(--color-text);
    background: color-mix(in oklab, var(--color-red) 6%, transparent);
  }
  .tab-pill.is-active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 14px;
    right: 14px;
    height: 2px;
    background: var(--color-red);
  }
</style>
