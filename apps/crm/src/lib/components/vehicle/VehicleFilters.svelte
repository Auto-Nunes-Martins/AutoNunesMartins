<script lang="ts">
  import FilterChoice from '$lib/components/common/FilterChoice.svelte';
  import FilterChoiceGroup from '$lib/components/common/FilterChoiceGroup.svelte';
  import { page } from '$app/stores';
  import { filterNavigation } from '$lib/filterNavigation';
  import { Search, X } from 'lucide-svelte';
  import type { Fuel, VehicleStatus } from '@anm/types';

  interface Props {
    filters: {
      agedStock?: boolean;
      brand?: string;
      model?: string;
      fuel?: Fuel;
      status?: VehicleStatus;
      yearMin?: number;
      yearMax?: number;
      mileageMin?: number;
      mileageMax?: number;
      q?: string;
    };
  }

  let { filters }: Props = $props();
  const navigation = filterNavigation(() => $page.url);

  const FUELS: { value: Fuel; label: string }[] = [
    { value: 'GASOLINE', label: 'Gasolina' },
    { value: 'DIESEL', label: 'Gasóleo' },
    { value: 'HYBRID', label: 'Híbrido' },
    { value: 'PLUGIN_HYBRID', label: 'Híbrido Plug-in' },
    { value: 'ELECTRIC', label: 'Elétrico' },
    { value: 'LPG', label: 'GPL' },
  ];

  const STATUSES: { value: VehicleStatus; label: string }[] = [
    { value: 'DRAFT', label: 'Rascunho' },
    { value: 'AVAILABLE', label: 'Disponível' },
    { value: 'RESERVED', label: 'Reservado' },
    { value: 'SOLD', label: 'Vendido' },
    { value: 'DELIVERED', label: 'Entregue' },
    { value: 'DOCS_PENDING', label: 'Docs Pendentes' },
    { value: 'RETURNED', label: 'Devolvidas (histórico)' },
  ];

  function setFilter(key: string, value: string | undefined) {
    navigation.set(key, value);
  }

  function toggleChip(key: string, value: string, currentValue: string | undefined) {
    setFilter(key, currentValue === value ? undefined : value);
  }

  const hasFilters = $derived(
    Boolean(
      filters.agedStock ||
      filters.brand ||
      filters.model ||
      filters.fuel ||
      filters.status ||
      filters.yearMin ||
      filters.yearMax ||
      filters.mileageMin ||
      filters.mileageMax ||
      filters.q,
    ),
  );

  function clearAll() {
    navigation.clear();
  }
</script>

<div class="space-y-4">
  <!-- Search row. flex-wrap so the "Limpar filtros" chip drops to its own
       row on a narrow viewport instead of squeezing the input below
       readable width. -->
  <div class="flex flex-wrap items-center gap-3">
    <div
      class="flex-1 relative flex items-center h-11 px-3 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] focus-within:border-[var(--color-red)] transition-colors"
      style="border-radius: var(--radius-btn);"
    >
      <Search class="h-4 w-4 text-[var(--color-text-faint)]" />
      <input
        type="search"
        aria-label="Pesquisar viaturas por marca, modelo, matrícula ou VIN"
        placeholder="Pesquisar por marca, modelo ou VIN…"
        value={filters.q ?? ''}
        oninput={(e) => navigation.set('q', e.currentTarget.value, true)}
        onkeydown={(e) => {
          if (e.key === 'Enter') navigation.flush();
        }}
        class="min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--color-text-faint)]"
      />
    </div>
    {#if hasFilters}
      <button
        type="button"
        onclick={clearAll}
        class="inline-flex items-center gap-1.5 px-3 h-11 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors"
      >
        <X class="h-3 w-3" />
        Limpar filtros
      </button>
    {/if}
  </div>

  {#if filters.agedStock}<div
      class="flex flex-wrap items-center gap-2 text-[12px] text-[var(--color-text-muted)]"
    >
      <span>Filtro do dashboard: stock disponível acima do limite de antiguidade definido.</span
      ><button
        type="button"
        class="text-[var(--color-red)] underline"
        onclick={() => setFilter('agedStock', undefined)}>Retirar filtro</button
      >
    </div>{/if}
  <div class="flex flex-col gap-2">
    <FilterChoiceGroup label="Estado">
      {#each STATUSES as s (s.value)}
        <FilterChoice
          selected={filters.status === s.value}
          onclick={() => toggleChip('status', s.value, filters.status)}>{s.label}</FilterChoice
        >
      {/each}
    </FilterChoiceGroup>
    <FilterChoiceGroup label="Combustível">
      {#each FUELS as f (f.value)}
        <FilterChoice
          selected={filters.fuel === f.value}
          onclick={() => toggleChip('fuel', f.value, filters.fuel)}>{f.label}</FilterChoice
        >
      {/each}
    </FilterChoiceGroup>
  </div>
  <!-- Range filters -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    <label class="flex flex-col gap-1">
      <span
        class="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]"
      >
        Ano · Mín.
      </span>
      <input
        type="number"
        min="1950"
        placeholder="2000"
        value={filters.yearMin ?? ''}
        oninput={(e) => navigation.set('yearMin', e.currentTarget.value, true)}
        class="h-10 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[13px] tabular-nums outline-none focus:border-[var(--color-red)] transition-colors"
        style="border-radius: var(--radius-btn);"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span
        class="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]"
      >
        Ano · Máx.
      </span>
      <input
        type="number"
        min="1950"
        placeholder="2026"
        value={filters.yearMax ?? ''}
        oninput={(e) => navigation.set('yearMax', e.currentTarget.value, true)}
        class="h-10 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[13px] tabular-nums outline-none focus:border-[var(--color-red)] transition-colors"
        style="border-radius: var(--radius-btn);"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span
        class="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]"
      >
        Km · Mín.
      </span>
      <input
        type="number"
        min="0"
        placeholder="0"
        value={filters.mileageMin ?? ''}
        oninput={(e) => navigation.set('mileageMin', e.currentTarget.value, true)}
        class="h-10 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[13px] tabular-nums outline-none focus:border-[var(--color-red)] transition-colors"
        style="border-radius: var(--radius-btn);"
      />
    </label>
    <label class="flex flex-col gap-1">
      <span
        class="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]"
      >
        Km · Máx.
      </span>
      <input
        type="number"
        min="0"
        placeholder="200000"
        value={filters.mileageMax ?? ''}
        oninput={(e) => navigation.set('mileageMax', e.currentTarget.value, true)}
        class="h-10 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[13px] tabular-nums outline-none focus:border-[var(--color-red)] transition-colors"
        style="border-radius: var(--radius-btn);"
      />
    </label>
  </div>
</div>
