<script lang="ts">
  import ReviewsEditor from '$lib/components/site/ReviewsEditor.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Reviews · Site público · Auto Nunes Martins</title></svelte:head>
<ReviewsEditor initialItems={data.items} />
