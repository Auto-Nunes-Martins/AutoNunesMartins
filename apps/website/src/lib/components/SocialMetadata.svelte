<script lang="ts">
  import { page } from '$app/stores';
  let { title, description, canonical, image = '/images/social/auto-nunes-martins-v1.png', imageAlt = 'Logótipo Auto Nunes Martins — comércio de automóveis', brandImage = true }: {
    title: string;
    description: string;
    canonical: string;
    image?: string;
    imageAlt?: string;
    brandImage?: boolean;
  } = $props();
  const imageUrl = $derived(new URL(image, $page.url.origin).href);
</script>

<svelte:head>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Auto Nunes Martins" />
  <meta property="og:locale" content="pt_PT" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={imageUrl} />
  {#if imageUrl.startsWith('https:')}<meta property="og:image:secure_url" content={imageUrl} />{/if}
  {#if brandImage}
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
  {/if}
  <meta property="og:image:alt" content={imageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
