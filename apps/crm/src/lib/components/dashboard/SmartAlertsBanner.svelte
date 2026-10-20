<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { ChevronRight, Car, Clock, ListChecks, Tag } from 'lucide-svelte';
  import type { SmartAlerts } from '$lib/server/dashboard';

  interface Props {
    alerts: SmartAlerts;
  }

  let { alerts }: Props = $props();

  const items = $derived(
    [
      alerts.stockAged > 0 && {
        icon: Car,
        label: `${alerts.stockAged} viatura${alerts.stockAged === 1 ? '' : 's'} em stock há mais de ${alerts.stockAgingDays ?? 60} dias`,
        href: crmPath('/viaturas?agedStock=true'),
      },
      alerts.tasksDueOrOverdue > 0 && {
        icon: ListChecks,
        label: `${alerts.tasksDueOrOverdue} tarefa${alerts.tasksDueOrOverdue === 1 ? '' : 's'} para hoje ou em atraso`,
        href: crmPath('/tarefas?attention=due'),
      },
      alerts.remindersToday > 0 && {
        icon: Clock,
        label: `${alerts.remindersToday} lembrete${alerts.remindersToday === 1 ? '' : 's'} para hoje`,
        href: crmPath('/tarefas?attention=reminders'),
      },
      // Rascunhos — viaturas que entraram no stock (tipicamente via retoma)
      // mas ainda sem preço definido. Aparecem aqui como warning porque
      // estão paradas à espera de uma decisão do dono para serem publicadas.
      alerts.draftVehicles > 0 && {
        icon: Tag,
        label: `${alerts.draftVehicles} viatura${alerts.draftVehicles === 1 ? '' : 's'} em rascunho — preço por definir`,
        href: crmPath('/viaturas?status=DRAFT'),
      },
    ].filter((x): x is { icon: typeof Car; label: string; href: string } => Boolean(x)),
  );

  const hasAny = $derived(items.length > 0);
</script>

{#if hasAny}
  <section class="grid grid-cols-1 md:grid-cols-3 gap-3">
    {#each items as item, i (i)}
      <a
        href={item.href}
        class="alert-card group flex items-center gap-3 px-4 py-3.5 border bg-[color-mix(in_oklab,var(--color-warning)_6%,var(--color-bg-1))] border-[color-mix(in_oklab,var(--color-warning)_30%,var(--color-border))] hover:bg-[color-mix(in_oklab,var(--color-warning)_10%,var(--color-bg-1))] transition-colors"
        style="border-radius: var(--radius-card);"
      >
        <item.icon class="h-5 w-5 text-[var(--color-warning)] flex-shrink-0" />
        <span class="h-5 w-[1.5px] bg-[var(--color-warning)] flex-shrink-0" aria-hidden="true"
        ></span>
        <span class="text-[13px] leading-relaxed text-[var(--color-text)] flex-1">{item.label}</span
        >
        <ChevronRight
          class="h-3.5 w-3.5 text-[var(--color-text-faint)] group-hover:text-[var(--color-warning)] transition-colors flex-shrink-0"
        />
      </a>
    {/each}
  </section>
{/if}

<style>
  .alert-card:focus-visible {
    outline: 2px solid var(--color-warning);
    outline-offset: 3px;
  }
</style>
