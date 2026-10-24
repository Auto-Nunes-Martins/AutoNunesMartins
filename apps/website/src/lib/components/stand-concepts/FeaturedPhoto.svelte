<script lang="ts">
  import { untrack } from 'svelte';
  import { featuredPhotoSizes } from './images';
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';
  import { catalogPlaceholder } from '$lib/localAssets';

  let {
    source,
    alt,
    onfailure,
    ondisplay,
  }: { source: string; alt: string; onfailure: (failed: boolean) => void; ondisplay: (source: string) => void } = $props();
  type Frame = { source: string; alt: string; fallback: boolean };
  let displayed = $state<Frame>(untrack(() => ({ source, alt, fallback: false })));
  let pending = $state<Frame | undefined>();
  $effect(() => {
    const next = { source, alt, fallback: false };
    untrack(() => {
      pending = source === displayed.source ? undefined : next;
      onfailure(source === displayed.source && displayed.fallback);
      if (source === displayed.source) ondisplay(source);
    });
  });
  async function ready(frame: Frame, image: HTMLImageElement) {
    try {
      await image.decode();
    } catch {
      return;
    }
    if (pending !== frame || source !== frame.source) return;
    // Promote this same decoded DOM image; never replace it with a second request.
    displayed = frame;
    pending = undefined;
    onfailure(frame.fallback);
    ondisplay(frame.source);
  }
  function failed(frame: Frame) {
    if (frame.fallback || frame.source !== source) return;
    frame.fallback = true;
    if (frame === displayed) onfailure(true);
  }
</script>

{#each pending ? [displayed, pending] : [displayed] as frame (frame.source)}
  <img
    src={frame.fallback ? catalogPlaceholder : sizedPhoto(frame.source, 1600)}
    srcset={frame.fallback ? undefined : vehiclePhotoSet(frame.source)}
    sizes={featuredPhotoSizes}
    width="1600"
    height="1067"
    alt={frame === displayed ? frame.alt : ''}
    aria-hidden={frame !== displayed ? true : undefined}
    class:featured-photo-pending={frame !== displayed}
    fetchpriority="high"
    decoding="async"
    onload={(event) => ready(frame, event.currentTarget as HTMLImageElement)}
    onerror={() => failed(frame)}
  />
{/each}

<style>
  img.featured-photo-pending {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }
</style>
