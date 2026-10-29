<script lang="ts">
  import { registeredBrand } from '@anm/types';
  import { brandLogo } from '$lib/brandLogos';
  let { name, size = 28 }: { name: string; size?: number } = $props();
  let failed = $state(false);
  const src = $derived(brandLogo(registeredBrand(name)?.logo ?? null));
  $effect(() => {
    name;
    failed = false;
  });
</script>

{#if src && !failed}<img
    {src}
    alt=""
    width={size}
    height={size}
    style:width={size + 'px'}
    style:height={size + 'px'}
    onerror={() => (failed = true)}
  />{/if}

<style>
  img {
    display: inline-block;
    vertical-align: middle;
    object-fit: contain;
    flex-shrink: 0;
    filter: grayscale(1);
  }
  :global([data-theme='dark']) img {
    filter: grayscale(1) invert(1);
  }
</style>
