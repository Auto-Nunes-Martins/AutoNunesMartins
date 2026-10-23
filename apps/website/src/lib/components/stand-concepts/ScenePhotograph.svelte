<script lang="ts">
  import type { SceneBackground } from './homeVisualFamilies';
  import { coverImageSizes } from '$lib/coverImageSizes';
  let { background }: { background: SceneBackground } = $props();
</script>

<picture
  use:coverImageSizes={{
    desktop: background.width / background.height,
    portrait: background.portraitAspectRatio ?? 0.75,
  }}
  style:--scene-focus={background.focus}
  style:--scene-mobile-focus={background.mobileFocus}
>
  {#if background.avifPortrait}<source
      type="image/avif"
      media="(max-width: 700px)"
      srcset={background.avifPortrait}
      sizes="max(100vw, 90vh)"
    />{/if}
  <source media="(max-width: 700px)" srcset={background.portrait} sizes="max(100vw, 90vh)" />
  {#if background.avifDesktop}<source
      type="image/avif"
      srcset={background.avifDesktop}
      sizes="max(100vw, 150vh)"
    />{/if}
  <img
    src={background.src}
    srcset={background.desktop}
    sizes="max(100vw, 150vh)"
    width={background.width}
    height={background.height}
    style:filter={background.exposure === undefined
      ? undefined
      : `saturate(.45) brightness(${background.exposure})`}
    alt=""
    loading="lazy"
    decoding="async"
  />
</picture>

<style>
  picture {
    position: absolute;
    inset: 0;
    z-index: -2;
    display: block;
  }
  img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: cover;
    object-position: var(--scene-focus);
    filter: saturate(0.45);
  }
  @media (max-width: 700px) {
    img {
      object-position: var(--scene-mobile-focus);
    }
  }
</style>
