<script lang="ts">
  import ComparisonPage from '$lib/features/selection/ComparisonPage.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
</script>

<SitePage compare>
  {#snippet routeContent()}
    <ComparisonPage />
  {/snippet}
</SitePage>
