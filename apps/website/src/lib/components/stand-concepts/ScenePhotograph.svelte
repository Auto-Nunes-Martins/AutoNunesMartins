<script lang="ts">
  import type { SceneBackground } from './homeVisualFamilies';
  import { coverImageSizes } from '$lib/coverImageSizes';
  let { background, bounded = false }: { background: SceneBackground; bounded?: boolean } = $props();
  function density(node: HTMLPictureElement, enabled: boolean) {
    if (!enabled) return;
    const update = () => node.style.setProperty('--scene-density', String(window.devicePixelRatio || 1));
    update();
    window.addEventListener('resize', update);
    return { destroy() { window.removeEventListener('resize', update); } };
  }
</script>

<picture
  class:bounded
  use:density={bounded}
  use:coverImageSizes={{
    desktop: background.width / background.height,
    portrait: bounded ? background.width / background.height : background.portraitAspectRatio ?? 0.75,
  }}
  style:--scene-focus={background.focus}
  style:--scene-mobile-focus={background.mobileFocus}
  style:--scene-native-height={`${background.height}px`}
>
  {#if background.avifPortrait}<source
      type="image/avif"
      media="(max-width: 700px)"
      srcset={bounded ? background.avifDesktop : background.avifPortrait}
      sizes="max(100vw, 90vh)"
    />{/if}
  <source media="(max-width: 700px)" srcset={bounded ? background.desktop : background.portrait} sizes="max(100vw, 90vh)" />
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
    picture.bounded {
      /* The master cannot fill the full stacked form at native density.
         Keep the photo at the top and blend into the existing dark surface. */
      bottom: auto;
      height: min(100%, 100svh, calc(var(--scene-native-height) / var(--scene-density, 1)));
      mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
    }
    img {
      object-position: var(--scene-mobile-focus);
    }
  }
</style>
