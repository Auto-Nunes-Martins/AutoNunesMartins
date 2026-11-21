<script lang="ts">
  import { vehicleDetailRuntime } from '$lib/vehicleDetailRuntime';
  import SitePage from '$lib/features/layout/SitePage.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<SitePage
  publicVehicle={data.vehicle}
  relatedVehicles={data.relatedVehicles}
  galleryRuntime={vehicleDetailRuntime}
/>
