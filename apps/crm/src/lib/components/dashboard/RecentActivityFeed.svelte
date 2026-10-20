<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { Activity, User as UserIcon } from 'lucide-svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import { formatDate } from '$lib/utils/format';
  import type { RecentActivityRow } from '$lib/server/dashboard';
  import { activityStyle as styleFor } from '$lib/activityPresentation';

  interface Props {
    items: RecentActivityRow[];
    /** Header title (default: "Atividade Recente"). Overridden by the tasks
     *  page to read "Atividade de Tarefas" so the panel context is clear. */
    title?: string;
    dashboard?: boolean;
  }

  let { items, title = 'Atividade Recente', dashboard = false }: Props = $props();

  function hrefFor(row: RecentActivityRow): string | null {
    switch (row.entityType) {
      case 'vehicle':
        return crmPath(`/viaturas/${row.entityId}`);
      case 'sale':
        return crmPath(`/vendas/${row.entityId}`);
      case 'customer':
        return crmPath(`/clientes/${row.entityId}`);
      case 'task':
        return crmPath(`/tarefas/${row.entityId}/editar`);
      default:
        return null;
    }
  }

  function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return 'agora';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return formatDate(iso);
  }
</script>

<Panel>
  <div class:dashboard-activity={dashboard}>
    <PanelHeader
      variant={dashboard ? 'dashboard' : 'default'}
      icon={Activity}
      iconClass={dashboard ? 'text-[var(--color-info)]' : 'text-[var(--color-text)]'}
      {title}
      meta={`${items.length} EVENTOS`}
    />

    {#if items.length === 0}
      <div
        class="p-8 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
      >
        Sem eventos recentes
      </div>
    {:else}
      <ul class="divide-y divide-[var(--color-border)]">
        {#each items as item (item.id)}
          {@const s = styleFor(item.type)}
          {@const Icon = s.icon}
          {@const href = hrefFor(item)}
          {@const actorLabel = item.actor?.name ?? 'Sistema'}
          <li>
            {#if href}
              <a
                {href}
                class="activity-row flex items-center gap-3 px-4 py-2.5 hover:bg-[color-mix(in_oklab,var(--color-red)_5%,transparent)] transition-colors group"
              >
                <Icon class="activity-icon h-4 w-4 flex-shrink-0" style="color: {s.color};" />
                <span
                  class="activity-time font-mono text-[10.5px] tabular-nums text-[var(--color-text-faint)] flex-shrink-0 w-10 text-right"
                >
                  {relativeTime(item.createdAt)}
                </span>
                <span
                  class="activity-message text-[13px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition-colors truncate flex-1"
                >
                  {item.message}
                </span>
                <span
                  class="activity-actor hidden md:flex font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-text-faint)] flex-shrink-0 items-center gap-1.5"
                  title={`Por ${actorLabel}`}
                >
                  <UserIcon class="h-3 w-3 opacity-70" />
                  {actorLabel}
                </span>
              </a>
            {:else}
              <div class="activity-row flex items-center gap-3 px-4 py-2.5">
                <Icon class="activity-icon h-4 w-4 flex-shrink-0" style="color: {s.color};" />
                <span
                  class="activity-time font-mono text-[10.5px] tabular-nums text-[var(--color-text-faint)] flex-shrink-0 w-10 text-right"
                >
                  {relativeTime(item.createdAt)}
                </span>
                <span
                  class="activity-message text-[13px] text-[var(--color-text-muted)] truncate flex-1"
                >
                  {item.message}
                </span>
                <span
                  class="activity-actor hidden md:flex font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--color-text-faint)] flex-shrink-0 items-center gap-1.5"
                  title={`Por ${actorLabel}`}
                >
                  <UserIcon class="h-3 w-3 opacity-70" />
                  {actorLabel}
                </span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</Panel>

<style>
  .dashboard-activity .activity-row {
    display: grid;
    grid-template-columns: 16px 38px minmax(0, 1fr) auto;
    align-items: start;
    column-gap: 14px;
    padding: 15px 20px;
  }
  .dashboard-activity :global(.activity-icon) {
    margin-top: 2px;
  }
  .dashboard-activity .activity-message {
    white-space: normal;
    overflow-wrap: anywhere;
    line-height: 1.55;
    color: var(--color-text-muted);
  }
  .dashboard-activity .activity-time {
    padding-top: 3px;
  }
  .dashboard-activity .activity-actor {
    display: flex;
    padding-top: 4px;
    font-size: 9px;
    letter-spacing: 0.03em;
    text-transform: none;
  }
  .dashboard-activity a:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: -3px;
  }
  @media (max-width: 640px) {
    .dashboard-activity .activity-row {
      grid-template-columns: 16px minmax(0, 1fr) auto;
      gap: 5px 10px;
    }
    .dashboard-activity .activity-message {
      grid-column: 2;
      grid-row: 1;
    }
    .dashboard-activity .activity-time {
      grid-column: 3;
      grid-row: 1;
      width: auto;
    }
    .dashboard-activity .activity-actor {
      grid-column: 2 / 4;
      grid-row: 2;
    }
  }
</style>
