<script lang="ts">
  import AboutPage from '$lib/features/about/AboutPage.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
</script>

<SitePage about>
  {#snippet routeContent({ contact })}
    <AboutPage onContact={(event) => contact(undefined, event.currentTarget)} />
  {/snippet}
</SitePage>
