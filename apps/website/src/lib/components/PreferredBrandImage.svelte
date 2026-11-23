<script lang="ts">
  import { jsonLdScript } from '$lib/jsonLdScript';

  let { canonical }: { canonical: string } = $props();
</script>

<svelte:head>
  {@html jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    url: canonical,
    primaryImageOfPage: new URL('/images/auto-nunes-martins-miniatura.png', canonical).href,
  })}
</svelte:head>
