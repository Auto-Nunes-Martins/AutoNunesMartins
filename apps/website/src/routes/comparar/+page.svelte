<script lang="ts">
  import OrbitComparison from '$lib/components/stand-concepts/OrbitComparison.svelte';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
</script>

<DesignEdition compare>
  {#snippet routeContent()}
    <OrbitComparison />
  {/snippet}
</DesignEdition>
