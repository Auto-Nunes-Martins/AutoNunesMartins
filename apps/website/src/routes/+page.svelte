<script lang="ts">
  import SitePage from '$lib/features/layout/SitePage.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<SitePage
  brandDirectory={data.brandDirectory}
  homeHighlights={data.highlights}
  stock={data.stock}
  reviews={data.reviews}
  campaigns={data.campaigns.items}
  standSelection={data.campaigns.selection}
/>
