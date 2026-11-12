<script lang="ts" generics="Vehicle extends { id: string; brand: string; model: string }">
  import { Check, Plus, Search } from 'lucide-svelte';
  import type { Snippet } from 'svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';

  let {
    vehicles,
    selected,
    canAdd,
    onAdd,
    query = $bindable(),
    searchLabel,
    placeholder,
    empty,
    focusTarget,
    fixedHeight = false,
    thumbnail,
    detail,
    intro,
    footer,
  }: {
    vehicles: Vehicle[];
    selected: ReadonlySet<string>;
    canAdd: boolean;
    onAdd: (vehicle: Vehicle) => void;
    query: string;
    searchLabel: string;
    placeholder: string;
    empty: string;
    focusTarget?: string;
    fixedHeight?: boolean;
    thumbnail: Snippet<[Vehicle]>;
    detail: Snippet<[Vehicle]>;
    intro?: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<section class="catalogue" class:fixed-height={fixedHeight} aria-label="Catálogo de viaturas">
  <Panel class="vehicle-catalogue-panel">
    <PanelHeader icon={Plus} title="Adicionar viaturas" {focusTarget} />
    <div class="catalogue-body">
      <label class="search">
        <Search size={16} aria-hidden="true" />
        <input type="search" aria-label={searchLabel} {placeholder} bind:value={query} />
      </label>
      {@render intro?.()}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The overflow list can be scrolled with the keyboard.) -->
      <ul class="candidates" aria-label="Viaturas elegíveis" tabindex="0">
        {#each vehicles as vehicle (vehicle.id)}
          {@const chosen = selected.has(vehicle.id)}
          {@const name = `${vehicle.brand} ${vehicle.model}`}
          {@const label = chosen ? `${name} adicionada` : `Adicionar ${name}`}
          <li class="candidate" class:chosen>
            <div class="thumbnail">{@render thumbnail(vehicle)}</div>
            <div class="identity">
              <strong>{name}</strong>
              <span>{@render detail(vehicle)}</span>
            </div>
            <button
              type="button"
              class="add-button"
              disabled={chosen || !canAdd}
              aria-label={label}
              title={label}
              onclick={() => onAdd(vehicle)}
            >
              {#if chosen}<Check size={17} aria-hidden="true" />
              {:else}<Plus size={17} aria-hidden="true" />{/if}
            </button>
          </li>
        {:else}
          <li class="empty">{empty}</li>
        {/each}
      </ul>
      {@render footer?.()}
    </div>
  </Panel>
</section>

<style>
  .catalogue {
    align-self: start;
    min-width: 0;
  }
  .catalogue-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: clamp(12px, 2vw, 20px);
  }
  .fixed-height {
    /* The desktop panel keeps room for the equivalent of two campaign cards. */
    block-size: 40rem;
  }
  .fixed-height > :global(.vehicle-catalogue-panel) {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .fixed-height .catalogue-body {
    flex: 1;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
    min-height: 44px;
    padding-inline: 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    color: var(--color-text-muted);
  }
  .search :global(svg) {
    flex: none;
  }
  .search input {
    width: 100%;
    min-width: 0;
    padding-inline: 0;
    outline: none;
    border: 0;
    background: transparent;
    color: var(--color-text);
  }
  .candidates:focus-visible,
  .search:focus-within {
    outline: 2px solid var(--color-red);
    outline-offset: 2px;
  }
  .candidates {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: min(50svh, 420px);
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    padding: 2px;
    margin: 0 -2px;
    list-style: none;
  }
  .fixed-height .candidates {
    flex: 1;
    max-height: none;
  }
  .candidate {
    flex: none;
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 9px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    padding: 4px 6px;
    transition:
      border-color 160ms ease,
      background-color 160ms ease;
  }
  .candidate.chosen {
    border-color: color-mix(in srgb, var(--color-red) 65%, var(--color-border));
    background: color-mix(in srgb, var(--color-red) 5%, transparent);
  }
  .thumbnail {
    min-width: 0;
    aspect-ratio: 4 / 3;
  }
  .identity {
    display: grid;
    gap: 4px;
    font-size: 13px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .identity span,
  .empty {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .empty {
    padding: 14px;
    font-size: 13px;
  }
  .add-button {
    display: grid;
    min-height: 44px;
    place-items: center;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
  }
  .add-button:not(:disabled):hover {
    border-color: var(--color-red);
  }
  .add-button:disabled {
    opacity: 0.55;
  }
  .chosen .add-button {
    border-color: transparent;
    color: var(--color-red);
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .candidate {
      transition: none;
    }
  }
  @media (max-width: 600px) {
    .candidate {
      grid-template-columns: 52px minmax(0, 1fr) 44px;
    }
    .candidates {
      max-height: min(46svh, 340px);
    }
  }
  @container (max-width: 670px) {
    .fixed-height {
      block-size: auto;
    }
    .fixed-height .candidates {
      flex: none;
      max-height: min(46svh, 340px);
    }
  }
</style>
