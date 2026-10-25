<script lang="ts">
  import OrbitFavorites from '$lib/components/stand-concepts/OrbitFavorites.svelte';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
</script>
<DesignEdition favorites>
  {#snippet routeContent({ card })}
    <OrbitFavorites {card} />
  {/snippet}
</DesignEdition>
