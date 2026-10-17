<script lang="ts">
  import { onMount } from 'svelte';
  import { aboutContent } from './aboutContent';
  import { lateralFade } from './heroBackgroundFade';
  import { measureGeometricStandCrop } from './geometricStandCrop';
  import { desktopStandAnchor, desktopStandRatioZoom, responsiveStandFraming, type ResponsiveStandFrame } from './responsiveStandFraming';
  import { validStandIndex, type StandIndex, type StandProfile, type StandSettings } from './heroStandSettings';
  let { settings = $bindable() }: { settings: StandSettings } = $props();
  let current = $state(0), visible = $state(true);
  let ready = $state([false, false]);
  const images: HTMLImageElement[] = [];
  let frames = $state<(ResponsiveStandFrame | null)[]>([null, null]);
  function imageStyle(index: number) {
    const frame = frames[index];
    // CSS applies these measurements only on tablet/mobile. A stale mobile
    // measurement must never resize a desktop image while ResizeObserver catches up.
    return frame ? `--responsive-photo-width:${frame.width}px;--responsive-photo-left:${frame.left}px;--responsive-photo-top:${frame.top}px;--responsive-photo-transform:none;` : undefined;
  }
  function measure() {
    for (const index of [0, 1] as const) {
      const profile = settings.profiles[index], image = images[index];
      if (!image) continue;
      const layer = image.closest<HTMLElement>('.home-stand-backdrop');
      if (!layer) continue;
      const box = layer.getBoundingClientRect();
      const frame = responsiveStandFraming(profile, index, window.innerWidth, box.width, box.height);
      if (JSON.stringify(frames[index]) !== JSON.stringify(frame)) frames[index] = frame;
      const bounds = image.getBoundingClientRect();
      const rendering = { mode: frame ? 'responsive' as const : 'reference' as const, viewport: window.innerWidth, imageWidth: bounds.width, imageHeight: bounds.height, left: bounds.left - box.left, top: bounds.top - box.top };
      if (JSON.stringify(profile.rendering) !== JSON.stringify(rendering)) profile.rendering = rendering;
      if (!profile.symmetricCrop) continue;
      const crop = measureGeometricStandCrop(image);
      if (profile.cropLeft !== crop.left) profile.cropLeft = crop.left;
      if (profile.cropRight !== crop.right) profile.cropRight = crop.right;
      if (profile.cropPossible !== crop.possible) profile.cropPossible = crop.possible;
    }
  }
  const measurementKey = $derived(settings.profiles.map(profile => [profile.width, profile.height, profile.zoom, profile.x, profile.y, profile.symmetricCrop, profile.cropLeft, profile.cropRight].join(',')).join('|'));
  $effect(() => {
    measurementKey;
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  });
  const photos = [{ src: aboutContent.heroImage.id, avif: aboutContent.heroImage.avif }, { src: aboutContent.approach.image, avif: aboutContent.approach.avif }];
  function style(profile: StandProfile, index: StandIndex) {
    const fade = lateralFade(profile.fade);
    const anchor = desktopStandAnchor(profile,index);
    return `--desktop-photo-x:${anchor.x}%;--desktop-focal-x:${anchor.focalX}%;--photo-width:${profile.width}vw;--photo-height:${profile.height}%;--photo-zoom:${profile.zoom}cqw;--photo-ratio-zoom:${profile.zoom * 4 / 3}cqh;--photo-reference-zoom:${desktopStandRatioZoom(profile)}cqh;--photo-crop-left:${profile.cropLeft}%;--photo-crop-right:${profile.cropRight}%;${profile.x === null ? '' : `--photo-x:${profile.x}%;`}${profile.y === null ? '' : `--photo-y:${profile.y}%;`}${fade === null ? '' : `--lateral-fade:${fade};--lateral-mask:linear-gradient(#000,#000);`}`;
  }
  $effect(() => { settings.revision; current = validStandIndex(settings.selected); });
  $effect(() => {
    if (!settings.playing || !visible || !ready.every(Boolean)) return;
    const timer = window.setInterval(() => { current = (current + 1) % photos.length; }, Math.max(3, settings.interval) * 1000);
    return () => window.clearInterval(timer);
  });
  onMount(() => {
    const update = () => { visible = !document.hidden; };
    update(); document.addEventListener('visibilitychange', update);
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    for (const image of images) observer.observe(image);
    window.addEventListener('resize', schedule);
    schedule();
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('resize', schedule); observer.disconnect(); cancelAnimationFrame(frame); };
  });
</script>

{#each photos as photo, index}
  <div class="home-stand-backdrop stand-layer" class:visible={current === index} data-stand-image={index + 1} data-active={current === index} aria-hidden="true" style={style(settings.profiles[index as StandIndex],index as StandIndex)}>
    <!-- Full source resolution: this image is enlarged and clipped, even on mobile. -->
    <picture style="display: contents">
      <source type="image/avif" srcset={photo.avif} />
      <img bind:this={images[index]} style={imageStyle(index)} src={photo.src} width="1024" height="768" alt="" loading="eager" fetchpriority={index === 0 ? 'high' : 'low'} decoding="async" onload={() => { ready[index] = true; measure(); }} />
    </picture>
  </div>
{/each}

<style>
  .stand-layer { opacity: 0; transition: opacity 1.2s ease-in-out; }
  .stand-layer.visible { opacity: 1; }
  @media(prefers-reduced-motion:reduce) { .stand-layer { transition: none; } }
</style>
