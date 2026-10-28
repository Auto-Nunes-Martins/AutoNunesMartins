<script lang="ts">
  import type { Snippet } from 'svelte';
  let { label, children }: { label: string; children?: Snippet } = $props();
</script>

<div class="filter-choice-group" role="group" aria-label={label}>
  <span class="choice-category">{label}<span aria-hidden="true">:</span></span>
  {@render children?.()}
</div>

<style>
  .filter-choice-group {
    min-width: 0;
    max-width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .choice-category {
    flex-shrink: 0;
    margin-right: 3px;
    color: var(--color-text-muted);
    font: 500 12px/1.4 var(--font-sans);
  }
</style>
