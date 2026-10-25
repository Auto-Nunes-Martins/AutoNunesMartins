<script lang="ts">
  import LegalInformation from '$lib/components/LegalInformation.svelte';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
</script>

<DesignEdition privacy legalInformation>
  {#snippet routeContent()}
    <LegalInformation />
  {/snippet}
</DesignEdition>
