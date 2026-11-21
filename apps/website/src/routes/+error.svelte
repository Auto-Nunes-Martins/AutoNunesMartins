<script lang="ts">
  import { page } from '$app/stores';
  import SitePage from '$lib/features/layout/SitePage.svelte';
  import { publicErrorCopy } from '$lib/publicError';
  const content = $derived(publicErrorCopy($page.status, $page.url.pathname));
  const unavailableVehicle = $derived(
    $page.status === 404 ? $page.error?.unavailableVehicle : undefined,
  );
</script>

<svelte:head>
  <title
    >{unavailableVehicle
      ? `${unavailableVehicle.brand} ${unavailableVehicle.model} ${unavailableVehicle.year} — Já não disponível`
      : content.title} — Auto Nunes Martins</title
  >
  <meta name="robots" content="noindex, follow" />
</svelte:head>
<SitePage id="unavailable" errorStatus={$page.status} {unavailableVehicle} />
