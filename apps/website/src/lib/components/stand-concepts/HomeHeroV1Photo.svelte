<script lang="ts">
  import { onMount } from 'svelte';
  import { catalogPlaceholder } from '$lib/localAssets';
  import { sizedPhoto } from '$lib/vehiclePhotoSources';

  let {
    src,
    main = false,
    eager = false,
  }: { src: string; main?: boolean; eager?: boolean } = $props();
  let image: HTMLImageElement;
  let ready = $state(false);
  let failed = $state(false);
  const smallSources = $derived(
    [800, 1600].map((width) => `${sizedPhoto(src, width)} ${width}w`).join(', '),
  );
  // Only known derivative dimensions: never label a 1920px master as 2560px.
  const fullSource = $derived(sizedPhoto(src, main ? 800 : 320));

  function loaded() {
    ready = true;
  }
  function fallback() {
    failed = true;
    ready = true;
  }
  onMount(() => {
    if (image.complete) {
      if (image.naturalWidth) loaded();
      else fallback();
    }
  });
</script>

<span class="v1-photo" class:v1-photo-ready={ready} class:v1-photo-failed={failed}>
  <picture>
    {#if !failed && main}
      <source
        srcset={smallSources}
        sizes="(max-width: 700px) min(380px, calc(100vw - 48px)), (max-width: 1050px) 380px, (min-width: 2000px) 450px, 426px"
      />
    {/if}
    <img
      bind:this={image}
      src={failed ? catalogPlaceholder : fullSource}
      alt=""
      aria-hidden="true"
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager && main ? 'high' : 'low'}
      decoding="async"
      onload={loaded}
      onerror={fallback}
    />
  </picture>
  {#if !ready && main}<span class="v1-photo-loading" aria-hidden="true">A carregar fotografia…</span
    >{/if}
  {#if failed && main}<span class="v1-photo-message">Fotografia temporariamente indisponível</span
    >{/if}
</span>

<style>
  .v1-photo,
  picture {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .v1-photo {
    overflow: hidden;
    background: #252729;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 52%;
    opacity: 0;
    transition: opacity 260ms ease;
  }
  .v1-photo-ready img {
    opacity: 1;
  }
  .v1-photo-failed img {
    object-fit: contain;
    padding: 10%;
    opacity: 0.6;
  }
  .v1-photo-message {
    position: absolute;
    left: 24px;
    right: 24px;
    bottom: 8px;
    text-align: center;
    color: #fff;
    font:
      400 10px/1.5 'Orbit Inter',
      Arial,
      sans-serif;
  }
  .v1-photo-loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #c6c6c8;
    font:
      400 11px/1.5 'Orbit Inter',
      Arial,
      sans-serif;
  }
  @media (prefers-reduced-motion: reduce) {
    img {
      transition: none;
    }
  }
</style>
