<script lang="ts">
  import type { Snippet } from 'svelte';
  let { label, children }: { label: string; children?: Snippet } = $props();
</script>

<fieldset class="filter-choice-group">
  <legend>{label}</legend>
  <div class="choice-track">{@render children?.()}</div>
</fieldset>

<style>
  .filter-choice-group {
    min-width: 0;
    max-width: 100%;
    margin-inline: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 7px;
    padding: 0;
    color: var(--color-text-muted);
    font: 500 10px/1.5 var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .choice-track {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    width: fit-content;
    max-width: 100%;
    padding: 4px;
    border: 1px solid var(--color-border);
    border-radius: calc(var(--radius-card) + 4px);
    background: var(--color-bg-0);
  }
</style>
