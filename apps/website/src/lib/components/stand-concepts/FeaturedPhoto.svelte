<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { framingStyle, type PhotoFraming } from '@anm/types';
  import { featuredPhotoSizes } from './images';
  import { cardPhoto, cardPhotoSet } from '$lib/vehiclePhotoSources';
  import { coverPhotoSizes } from '$lib/coverPhotoSizes';
  import { catalogPlaceholder } from '$lib/localAssets';

  let {
    source,
    framing,
    alt,
    onfailure,
    ondisplay,
  }: {
    source: string;
    framing?: PhotoFraming;
    alt: string;
    onfailure: (failed: boolean) => void;
    ondisplay: (source: string) => void;
  } = $props();
  type Frame = { source: string; alt: string; fallback: boolean; framing?: PhotoFraming };
  let displayed = $state<Frame>(untrack(() => ({ source, alt, framing, fallback: false })));
  let pending = $state<Frame | undefined>();
  let outgoing = $state<Frame | undefined>();
  let transitioning: Frame | undefined;
  let crossfade: Animation | undefined;
  onDestroy(() => crossfade?.cancel());
  $effect(() => {
    const next = { source, alt, framing, fallback: false };
    untrack(() => {
      crossfade?.cancel();
      transitioning = undefined;
      outgoing = undefined;
      pending = source === displayed.source ? undefined : next;
      if (source === displayed.source) displayed.framing = framing;
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
    if (pending !== frame || source !== frame.source || transitioning === frame) return;
    transitioning = frame;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    outgoing = reduced ? undefined : displayed;
    // Confirm the decoded entry once: photo, metadata, link and progress all
    // change in the same render. Only the old decorative layer fades away.
    displayed = frame;
    pending = undefined;
    transitioning = undefined;
    onfailure(frame.fallback);
    ondisplay(frame.source);
    await tick();
    if (source !== frame.source || displayed !== frame || reduced) return;
    const previous = image.parentElement?.querySelector<HTMLImageElement>(
      '.featured-photo-outgoing',
    );
    if (!previous) return;
    const fade = previous.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160,
      easing: 'ease-out',
      fill: 'forwards',
    });
    crossfade = fade;
    try {
      await fade.finished;
    } catch {
      return;
    }
    if (crossfade !== fade) return;
    outgoing = undefined;
    crossfade = undefined;
  }
  function failed(frame: Frame) {
    if (frame.fallback || frame.source !== source) return;
    frame.fallback = true;
    if (frame === displayed) onfailure(true);
  }
</script>

{#each [...(outgoing ? [outgoing] : []), displayed, ...(pending ? [pending] : [])] as frame (frame.source)}
  <img
    use:coverPhotoSizes
    style={frame.fallback ? undefined : framingStyle(frame.framing)}
    src={frame.fallback ? catalogPlaceholder : cardPhoto(frame.source)}
    srcset={frame.fallback ? undefined : cardPhotoSet(frame.source)}
    sizes={featuredPhotoSizes}
    width="1600"
    height="1067"
    alt={frame === displayed ? frame.alt : ''}
    aria-hidden={frame !== displayed ? true : undefined}
    class:featured-photo-pending={frame === pending}
    class:featured-photo-outgoing={frame === outgoing}
    fetchpriority="high"
    decoding="async"
    onload={(event) => ready(frame, event.currentTarget as HTMLImageElement)}
    onerror={() => failed(frame)}
  />
{/each}

<style>
  img { object-position: var(--photo-desktop, 50% 53%) !important; }
  @media (max-width:700px) { img { object-position: var(--photo-mobile, 50% 53%) !important; } }
  img.featured-photo-pending {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    z-index: 2;
  }
  img.featured-photo-outgoing {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }
</style>
