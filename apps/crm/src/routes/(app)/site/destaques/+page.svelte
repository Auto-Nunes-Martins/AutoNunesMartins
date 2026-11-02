<script lang="ts">
  import HomepageHighlightsEditor from '$lib/components/vehicle/HomepageHighlightsEditor.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Destaques da homepage · Site público · Auto Nunes Martins</title></svelte:head>
<HomepageHighlightsEditor editor={data.editor} selectedVehicleId={data.selectedVehicleId} />
