<script lang="ts">
  import BrandSun from '$lib/components/brand/icons/BrandSun.svelte';
  import BrandMoon from '$lib/components/brand/icons/BrandMoon.svelte';
  import { theme } from '$lib/stores/theme';

  interface Props {
    size?: number;
  }

  let { size = 38 }: Props = $props();
</script>

<button
  type="button"
  onclick={() => theme.toggle()}
  class="inline-flex items-center justify-center border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-strong)] transition-colors"
  style="box-sizing: border-box; flex-shrink: 0; padding: 0; width: {size}px; height: {size}px; border-radius: var(--radius-btn);"
  aria-label="Alternar tema"
>
  {#if $theme === 'dark'}
    <BrandSun class="h-[16px] w-[16px]" />
  {:else}
    <BrandMoon class="h-[16px] w-[16px]" />
  {/if}
</button>
