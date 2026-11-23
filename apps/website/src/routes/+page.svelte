<script lang="ts">
  import { page } from '$app/state';
  import PreferredBrandImage from '$lib/components/PreferredBrandImage.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<PreferredBrandImage canonical={new URL('/', page.url.origin).href} />

<SitePage
  brandDirectory={data.brandDirectory}
  homeHighlights={data.highlights}
  stock={data.stock}
  reviews={data.reviews}
  campaigns={data.campaigns.items}
  standSelection={data.campaigns.selection}
/>
