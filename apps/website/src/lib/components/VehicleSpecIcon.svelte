<script lang="ts">
  import VehicleSpecGlyph from '../../../../../shared/ui/VehicleSpecGlyph.svelte';
  import { brandLogo } from '$lib/brandLogos';
  let { label, value = '' }: { label: string; value?: string } = $props();
  const logo = $derived(label === 'Marca' ? brandLogo(value) : undefined);
</script>

{#if logo}
  <span
    class="spec-brand-logo"
    style={`mask-image: url('${logo}'); -webkit-mask-image: url('${logo}');`}
    aria-hidden="true"
  ></span>
{:else}
  <VehicleSpecGlyph {label} />
{/if}

<style>
  .spec-brand-logo {
    display: inline-block;
    width: 20px;
    height: 20px;
    background: currentColor;
    mask-size: contain;
    mask-position: center;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    flex-shrink: 0;
  }
</style>
