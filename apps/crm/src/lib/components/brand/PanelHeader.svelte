<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconComponent } from '$lib/types/ui';

  interface Props {
    icon: IconComponent;
    title: string;
    meta?: string;
    actions?: Snippet;
    /** Override the icon color (e.g. "text-[#e6b800]" for the trophy). Defaults to text. */
    iconClass?: string;
    variant?: 'default' | 'dashboard';
  }

  let {
    icon: Icon,
    title,
    meta,
    actions,
    iconClass = 'text-[var(--color-text)]',
    variant = 'default',
  }: Props = $props();
</script>

<div
  class="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3"
  class:dashboard-header={variant === 'dashboard'}
>
  <div class="flex items-center gap-2.5 min-w-0">
    <Icon class="h-[18px] w-[18px] {iconClass} flex-shrink-0" />
    <div class="h-[18px] w-[1.5px] bg-[var(--color-red)] flex-shrink-0"></div>
    <h3
      class="font-display text-[18px] font-bold italic uppercase tracking-[-0.01em] leading-none text-[var(--color-text)] truncate"
    >
      {title}
    </h3>
    {#if meta}
      <span
        class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] ml-1"
      >
        {meta}
      </span>
    {/if}
  </div>
  {#if actions}
    <div class="flex items-center gap-2">{@render actions()}</div>
  {/if}
</div>

<style>
  .dashboard-header {
    padding: 18px 20px;
    align-items: center;
    flex-wrap: wrap;
    row-gap: 12px;
  }
  .dashboard-header > div:first-child {
    display: grid;
    grid-template-columns: 18px 1.5px minmax(0, 1fr);
    column-gap: 10px;
    row-gap: 6px;
  }
  .dashboard-header :global(svg) {
    width: 18px;
    height: 18px;
    grid-row: 1 / 3;
  }
  .dashboard-header > div:first-child > div {
    display: block;
    grid-row: 1 / 3;
    height: 32px;
  }
  .dashboard-header h3 {
    grid-column: 3;
    font-size: 17px;
    line-height: 1.1;
    overflow: visible;
    white-space: normal;
  }
  .dashboard-header > div:first-child > span {
    grid-column: 3;
    margin-left: 0;
    font-size: 9px;
    letter-spacing: 0.09em;
  }
</style>
