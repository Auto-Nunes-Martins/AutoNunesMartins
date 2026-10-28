<script lang="ts">
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
  import PublicLegalContent from '$lib/components/PublicLegalContent.svelte';
</script>
<DesignEdition privacy>{#snippet routeContent()}<PublicLegalContent kind="disputes"/>{/snippet}</DesignEdition>
