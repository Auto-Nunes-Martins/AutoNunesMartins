<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit';
    form?: string;
    href?: string;
    reload?: boolean;
    disabled?: boolean;
    loading?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    class?: string;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    form,
    href,
    reload = false,
    disabled,
    loading,
    onclick,
    children,
    class: className = '',
  }: Props = $props();

  // Match prototype's .cta recipe exactly:
  //   Barlow, italic, weight 600 (semibold), 13px, letter-spacing .01em, uppercase
  const variantClass = {
    primary:
      'bg-[var(--color-red)] hover:bg-[var(--color-red-soft)] text-white font-display font-semibold italic uppercase tracking-[0.01em]',
    outline:
      'border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text)] font-mono uppercase tracking-[0.12em] text-[11px]',
    ghost:
      'text-[var(--color-text-muted)] hover:text-[var(--color-text)] font-mono uppercase tracking-[0.12em] text-[11px]',
    danger:
      'bg-transparent border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] font-mono uppercase tracking-[0.12em] text-[11px]',
  };

  const sizeClass = {
    sm: 'h-9 px-3 text-[12px]',
    md: 'h-11 px-[18px] text-[13px]',
    lg: 'h-12 px-5 text-[14px]',
  };

  const baseClass =
    'inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
</script>

{#if href}
  <a
    {href}
    data-sveltekit-reload={reload || undefined}
    aria-disabled={disabled || loading ? 'true' : undefined}
    tabindex={disabled || loading ? -1 : undefined}
    onclick={(event) => {
      if (disabled || loading) event.preventDefault();
      else onclick?.(event);
    }}
    class="crm-action {baseClass} {variantClass[variant]} {sizeClass[size]} {className}"
    style="border-radius: var(--radius-btn);"
  >
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    {form}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    onclick={(e) => onclick?.(e)}
    class="crm-action {baseClass} {variantClass[variant]} {sizeClass[size]} {className}"
    style="border-radius: var(--radius-btn);"
  >
    {#if loading}
      <span
        class="inline-block h-3 w-3 rounded-full border-2 border-current border-r-transparent animate-spin"
      ></span>
    {/if}
    {@render children?.()}
  </button>
{/if}

<style>
  .crm-action {
    white-space: nowrap;
  }
  a[aria-disabled='true'] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .crm-action:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  @media (max-width: 767px) {
    .crm-action {
      min-height: 44px;
    }
  }
</style>
