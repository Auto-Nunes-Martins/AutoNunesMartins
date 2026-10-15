<script lang="ts">
  import { page } from '$app/stores';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
  import { publicErrorCopy } from '$lib/publicError';
  const content = $derived(publicErrorCopy($page.status, $page.url.pathname));
</script>
<svelte:head>
  <title>{content.title} — Auto Nunes Martins</title>
  <meta name="robots" content="noindex, follow" />
</svelte:head>
<DesignEdition id="unavailable" errorStatus={$page.status} />
