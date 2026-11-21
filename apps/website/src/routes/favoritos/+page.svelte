<script lang="ts">
  import FavoritesPage from '$lib/features/selection/FavoritesPage.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
</script>

<SitePage favorites>
  {#snippet routeContent({ card })}
    <FavoritesPage {card} />
  {/snippet}
</SitePage>
