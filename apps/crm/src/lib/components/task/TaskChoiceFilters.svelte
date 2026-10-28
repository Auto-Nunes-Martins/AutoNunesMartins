<script lang="ts">
  import type { Priority } from '@anm/types';
  import { CalendarClock } from 'lucide-svelte';
  import FilterChoice from '$lib/components/common/FilterChoice.svelte';
  import FilterChoiceGroup from '$lib/components/common/FilterChoiceGroup.svelte';
  import { TASK_PRIORITIES } from './presentation';
  type Scope = 'all' | 'mine' | 'general';
  let {
    priority,
    scope,
    showScheduled,
    onpriority,
    onscope,
    onscheduled,
  }: {
    priority?: Priority;
    scope: Scope;
    showScheduled: boolean;
    onpriority: (value: Priority | undefined) => void;
    onscope: (value: Scope) => void;
    onscheduled: () => void;
  } = $props();
</script>

<div class="task-choice-filters">
  <FilterChoiceGroup label="Prioridade">
    {#each TASK_PRIORITIES as p (p.value)}
      <FilterChoice
        selected={priority === p.value}
        markerColor={p.color}
        onclick={() => onpriority(priority === p.value ? undefined : p.value)}
        >{p.label}</FilterChoice
      >
    {/each}
  </FilterChoiceGroup>

  <FilterChoiceGroup label="Visibilidade">
    {#each [{ value: 'all' as const, label: 'Todas' }, { value: 'mine' as const, label: 'Minhas' }, { value: 'general' as const, label: 'Gerais' }] as opt (opt.value)}
      <FilterChoice selected={scope === opt.value} onclick={() => onscope(opt.value)}
        >{opt.label}</FilterChoice
      >
    {/each}
  </FilterChoiceGroup>
  <FilterChoiceGroup label="Recorrência">
    <FilterChoice
      selected={showScheduled}
      onclick={onscheduled}
      title="Mostrar tarefas recorrentes (semanais, mensais, anuais) já agendadas para um próximo ciclo"
      ><CalendarClock class="h-3.5 w-3.5" />Tarefas agendadas</FilterChoice
    >
  </FilterChoiceGroup>
</div>

<style>
  .task-choice-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }
</style>
