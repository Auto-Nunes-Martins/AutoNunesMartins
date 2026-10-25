<script lang="ts">
  import OrbitPrivacy from '$lib/components/stand-concepts/OrbitPrivacy.svelte';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
</script>

<DesignEdition privacy>
  {#snippet routeContent()}
    <OrbitPrivacy />
  {/snippet}
</DesignEdition>
