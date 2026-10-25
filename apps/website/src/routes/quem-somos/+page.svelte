<script lang="ts">
  import OrbitAbout from '$lib/components/stand-concepts/OrbitAbout.svelte';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
</script>

<DesignEdition about>
  {#snippet routeContent({ contact })}
    <OrbitAbout onContact={() => contact()} />
  {/snippet}
</DesignEdition>
