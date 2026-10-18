<script lang="ts">
  import { page } from '$app/stores';
  import DesignEdition from '$lib/components/stand-concepts/DesignEdition.svelte';
  import { publicErrorCopy } from '$lib/publicError';
  const content = $derived(publicErrorCopy($page.status, $page.url.pathname));
  const archive = $derived($page.status === 404 ? $page.error?.archive : undefined);
</script>
<svelte:head>
  <title>{archive ? `${archive.brand} ${archive.model} ${archive.year} — Já não disponível` : content.title} — Auto Nunes Martins</title>
  <meta name="robots" content="noindex, follow" />
</svelte:head>
<DesignEdition id="unavailable" errorStatus={$page.status} archivedVehicle={archive} />
