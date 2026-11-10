<script lang="ts">
  import VehicleSpecGlyph from '../../../../../shared/ui/VehicleSpecGlyph.svelte';
  import { brandLogo } from '$lib/brandLogos';
  let { label, value = '' }: { label: string; value?: string } = $props();
  const logo = $derived(label === 'Marca' ? brandLogo(value) : undefined);
  let failedLogo = $state<string | undefined>();
</script>

{#if logo && failedLogo !== logo}
  <span class="spec-brand-tint" style:--spec-brand-mask={`url("${logo}")`} aria-hidden="true">
    <img
      class="spec-brand-logo"
      src={logo}
      alt=""
      width="20"
      height="20"
      onerror={() => (failedLogo = logo)}
    />
  </span>
{:else}
  <VehicleSpecGlyph {label} />
{/if}

<style>
  .spec-brand-tint {
    display: inline-flex;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    background-color: currentColor;
    mask: var(--spec-brand-mask) center / contain no-repeat;
  }
  .spec-brand-logo {
    opacity: 0;
  }
</style>
