<script lang="ts">
  import { page } from '$app/stores';
  let {
    title,
    description,
    canonical,
    image = '/images/social/auto-nunes-martins-v1.png',
    imageAlt = 'Logótipo Auto Nunes Martins — comércio de automóveis',
    brandImage = true,
    imageType = 'image/png',
    imageWidth,
    imageHeight,
  }: {
    title: string;
    description: string;
    canonical: string;
    image?: string;
    imageAlt?: string;
    brandImage?: boolean;
    imageType?: string;
    imageWidth?: number;
    imageHeight?: number;
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
  {#if brandImage || (imageWidth && imageHeight)}
    <meta property="og:image:type" content={imageType} />
    <meta property="og:image:width" content={String(imageWidth ?? 1200)} />
    <meta property="og:image:height" content={String(imageHeight ?? 630)} />
  {/if}
  <meta property="og:image:alt" content={imageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
