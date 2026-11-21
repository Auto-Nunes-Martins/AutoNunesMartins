<script lang="ts">
  import LegalInformation from '$lib/components/LegalInformation.svelte';
  import SitePage from '$lib/features/layout/SitePage.svelte';
</script>

<SitePage privacy legalInformation>
  {#snippet routeContent()}
    <LegalInformation />
  {/snippet}
</SitePage>
