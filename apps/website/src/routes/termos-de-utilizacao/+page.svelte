<script lang="ts">
  import SitePage from '$lib/features/layout/SitePage.svelte';
  import PublicLegalContent from '$lib/components/PublicLegalContent.svelte';
</script>

<SitePage privacy>{#snippet routeContent()}<PublicLegalContent />{/snippet}</SitePage>
