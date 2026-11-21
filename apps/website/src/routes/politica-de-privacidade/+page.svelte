<script lang="ts">
  import PrivacyPage from '$lib/features/privacy/PrivacyPage.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
</script>

<SitePage privacy>
  {#snippet routeContent()}
    <PrivacyPage />
  {/snippet}
</SitePage>
