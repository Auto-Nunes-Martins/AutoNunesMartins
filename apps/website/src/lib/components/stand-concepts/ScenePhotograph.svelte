<script lang="ts">
  import type { SceneBackground } from './homeVisualFamilies';
  let { background }: { background: SceneBackground } = $props();
</script>

<picture style:--scene-focus={background.focus} style:--scene-mobile-focus={background.mobileFocus}>
  <source media="(max-width: 700px)" srcset={background.portrait} sizes="max(100vw, 90vh)" />
  <img
    src={background.src}
    srcset={background.desktop}
    sizes="max(100vw, 150vh)"
    width={background.width}
    height={background.height}
    style:filter={background.exposure === undefined ? undefined : `saturate(.45) brightness(${background.exposure})`}
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
