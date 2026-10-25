<script lang="ts">
  import OrbitCatalog from '$lib/components/stand-concepts/OrbitCatalog.svelte';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<DesignEdition catalog stock={data.stock} brandDirectory={data.brandDirectory}>
  {#snippet routeContent({ card })}
    <OrbitCatalog {card} stock={data.stock} brandDirectory={data.brandDirectory} />
  {/snippet}
</DesignEdition>
