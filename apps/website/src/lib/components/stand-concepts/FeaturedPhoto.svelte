<script lang="ts">
  import { untrack } from 'svelte';
  import { sizedPhoto, vehiclePhotoSet } from '$lib/vehiclePhotoSources';
  import { catalogPlaceholder } from '$lib/localAssets';

  let {
    source,
    alt,
    onfailure,
  }: { source: string; alt: string; onfailure: (failed: boolean) => void } = $props();
  type Frame = { source: string; alt: string; fallback: boolean };
  let displayed = $state<Frame>(untrack(() => ({ source, alt, fallback: false })));
  let pending = $state<Frame | undefined>();
  $effect(() => {
    const next = { source, alt, fallback: false };
    untrack(() => {
      pending = source === displayed.source ? undefined : next;
      onfailure(source === displayed.source && displayed.fallback);
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
    sizes="(max-width: 700px) 100vw, 55vw"
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
