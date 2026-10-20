<script lang="ts">
  import { Check, Plus } from 'lucide-svelte';
  import { useComparison } from '$lib/comparison';
  let { id, name, overlay = false }: { id: string; name: string; overlay?: boolean } = $props();
  const comparison = useComparison();
  const { ids, ready } = comparison;
  const selected = $derived($ids.includes(id));
</script>

<button
  type="button"
  class:selected
  class:overlay
  disabled={!$ready}
  aria-pressed={selected}
  aria-label={`${selected ? 'Na comparação' : 'Comparar'}: ${name}${selected ? ' — remover da comparação' : ''}`}
  onclick={(event) => {
    event.stopPropagation();
    comparison.toggle(id, name);
  }}
>
  {selected ? 'Na comparação' : 'Comparar'}
  {#if selected}<Check size={overlay ? 14 : 15} strokeWidth={1.6} aria-hidden="true" />{:else}<Plus
      size={overlay ? 14 : 15}
      strokeWidth={1.6}
      aria-hidden="true"
    />{/if}
</button>

<style>
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    min-height: 44px;
    padding: 11px 20px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 7%, var(--bg));
    color: var(--text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  button.selected {
    background: color-mix(in srgb, var(--red) 9%, var(--bg));
    border-color: color-mix(in srgb, var(--red) 35%, transparent);
  }
  button.selected :global(svg) {
    color: var(--red);
  }
  button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: 4px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  button.overlay {
    min-height: 36px;
    gap: 6px;
    padding: 7px 12px;
    background: rgb(20 20 18 / 0.88);
    border: 0;
    color: #fff;
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
  }
  button.overlay.selected {
    background: var(--red);
  }
  button.overlay.selected :global(svg) {
    color: inherit;
  }
  button.overlay:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
    box-shadow: 0 0 0 5px rgb(0 0 0 / 0.7);
  }
  @media (pointer: coarse) {
    button.overlay {
      min-height: 44px;
      padding-block: 10px;
    }
  }
  @media (hover: hover) {
    button.overlay:hover {
      background: #3c3c38;
      color: #fff;
    }
    button.overlay.selected:hover {
      background: #b80510;
    }
  }
  @media (hover: hover) {
    button:hover {
      background: var(--text);
      color: var(--bg);
    }
    button.selected:hover :global(svg) {
      color: inherit;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    button {
      transition:
        background-color 180ms ease,
        border-color 180ms ease,
        color 180ms ease;
    }
  }
</style>
