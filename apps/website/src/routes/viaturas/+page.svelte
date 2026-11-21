<script lang="ts">
  import CatalogPage from '$lib/features/catalog/CatalogPage.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<SitePage catalog stock={data.stock} brandDirectory={data.brandDirectory}>
  {#snippet routeContent({ card })}
    <CatalogPage {card} stock={data.stock} brandDirectory={data.brandDirectory} />
  {/snippet}
</SitePage>
