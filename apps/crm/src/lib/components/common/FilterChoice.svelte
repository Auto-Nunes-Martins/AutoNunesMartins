<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    selected = false,
    disabled = false,
    compact = false,
    onclick,
    title,
    markerColor,
    children,
  }: {
    selected?: boolean;
    disabled?: boolean;
    compact?: boolean;
    onclick?: (event: MouseEvent) => void;
    title?: string;
    markerColor?: string;
    children?: Snippet;
  } = $props();
</script>

<button
  type="button"
  class="filter-choice"
  class:compact
  aria-pressed={selected}
  {disabled}
  {onclick}
  {title}
>
  {#if markerColor}<span class="choice-marker" style:background={markerColor} aria-hidden="true"
    ></span>{/if}
  <span class="choice-label">{@render children?.()}</span>
  <svg class="choice-check" viewBox="0 0 16 16" fill="none" aria-hidden="true"
    ><path
      d="m3.5 8 3 3 6-6"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    /></svg
  >
</button>

<style>
  .filter-choice {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 36px;
    max-width: 100%;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: var(--radius-card);
    background: transparent;
    color: var(--color-text-muted);
    font: 500 12px/1.4 var(--font-sans);
    text-align: left;
    transition:
      background-color 140ms,
      border-color 140ms,
      color 140ms;
  }
  .filter-choice:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-interaction-hover);
  }
  .filter-choice[aria-pressed='true'] {
    color: var(--color-text);
    background: var(--color-bg-2);
    border-color: var(--color-border-strong);
    font-weight: 600;
  }
  .filter-choice.compact {
    gap: 5px;
    padding-inline: 8px;
  }
  .compact .choice-check {
    width: 12px;
    height: 12px;
  }
  .filter-choice:focus-visible {
    outline: 2px solid var(--color-info);
    outline-offset: 2px;
  }
  .filter-choice:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .choice-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .choice-marker {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .choice-check {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--color-red);
    visibility: hidden;
  }
  [aria-pressed='true'] .choice-check {
    visibility: visible;
  }
  @media (pointer: coarse) {
    .filter-choice {
      min-height: 44px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .filter-choice {
      transition: none;
    }
  }
</style>
