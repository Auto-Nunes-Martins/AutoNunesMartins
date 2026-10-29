<script lang="ts">
  import VehicleSpecGlyph from '../../../../../shared/ui/VehicleSpecGlyph.svelte';
  import { brandLogo } from '$lib/brandLogos';
  let { label, value = '' }: { label: string; value?: string } = $props();
  const logo = $derived(label === 'Marca' ? brandLogo(value) : undefined);
  let failedLogo = $state<string | undefined>();
</script>

{#if logo && failedLogo !== logo}
  <img
    class="spec-brand-logo"
    src={logo}
    alt=""
    aria-hidden="true"
    width="20"
    height="20"
    onerror={() => (failedLogo = logo)}
  />
{:else}
  <VehicleSpecGlyph {label} />
{/if}

<style>
  .spec-brand-logo {
    display: inline-block;
    width: 20px;
    height: 20px;
    object-fit: contain;
    filter: grayscale(1);
    flex-shrink: 0;
  }
  :global(:where(html)[data-theme='dark']) .spec-brand-logo {
    filter: grayscale(1) invert(1);
  }
</style>
