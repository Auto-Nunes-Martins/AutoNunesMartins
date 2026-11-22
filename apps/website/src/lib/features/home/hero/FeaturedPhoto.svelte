<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
  import { photoFraming, type PhotoFraming } from '@anm/types';
  import { featuredPhotoSizesForRatio } from '../../catalog/responsiveImages';
  import { cardPhoto, cardPhotoSet, type PhotoDimensions } from '$lib/vehiclePhotoSources';
  import { coverPhotoSizes } from '$lib/coverPhotoSizes';
  import { catalogPlaceholder } from '$lib/localAssets';

  let {
    source,
    dimensions,
    framing,
    alt,
    onfailure,
    ondisplay,
  }: {
    source: string;
    dimensions?: PhotoDimensions;
    framing?: PhotoFraming;
    alt: string;
    onfailure: (failed: boolean) => void;
    ondisplay: (source: string) => void;
  } = $props();
  type Frame = {
    source: string;
    alt: string;
    fallback: boolean;
    framing?: PhotoFraming;
    dimensions?: PhotoDimensions;
  };
  // The cover, zoom and focus must already be represented in the server HTML.
  // The active device can change before hydration or while a slide is downloading.
  function cropStyle(device: 'desktop' | 'mobile', position?: PhotoFraming['desktop']) {
    if (!position) return '';
    const { x, y, fit = 'cover', zoom = 1 } = position;
    const focus =
      fit === 'contain' ? `var(--contain-x, ${x}%) var(--contain-y, ${y}%)` : `${x}% ${y}%`;
    return `--focus-${device}:${focus};--fit-${device}:${fit === 'auto' ? 'var(--auto-fit, cover)' : fit};--zoom-${device}:${zoom};`;
  }

  function hydratePhoto(node: HTMLImageElement, options: Parameters<typeof photoFraming>[1]) {
    const framing = photoFraming(node, options);
    node.dataset.framingLive = '';
    // A cached image can finish before this node is connected on client navigation.
    if (node.complete && node.naturalWidth && !node.hasAttribute('aria-hidden')) {
      void node
        .decode()
        .then(() => {
          if (node.isConnected && !node.hasAttribute('aria-hidden')) {
            node.closest('.hd-feature')?.setAttribute('data-featured-photo-ready', '');
          }
        })
        .catch(() => {});
    }
    return framing;
  }
  let displayed = $state<Frame>(
    untrack(() => ({ source, alt, framing, dimensions, fallback: false })),
  );
  let pending = $state<Frame | undefined>();
  let outgoing = $state<Frame | undefined>();
  let transitioning: Frame | undefined;
  let crossfade: Animation | undefined;
  onDestroy(() => crossfade?.cancel());
  $effect(() => {
    const next = { source, alt, framing, dimensions, fallback: false };
    untrack(() => {
      crossfade?.cancel();
      transitioning = undefined;
      outgoing = undefined;
      pending = source === displayed.source ? undefined : next;
      if (source === displayed.source) {
        displayed.framing = framing;
        displayed.dimensions = dimensions;
      }
      onfailure(source === displayed.source && displayed.fallback);
      if (source === displayed.source) ondisplay(source);
    });
  });
  async function ready(frame: Frame, image: HTMLImageElement) {
    try {
      await image.decode();
    } catch {
      if (!image.complete || !image.naturalWidth) return;
    }
    if (displayed === frame)
      image.closest('.hd-feature')?.setAttribute('data-featured-photo-ready', '');
    if (pending !== frame || source !== frame.source || transitioning === frame) return;
    transitioning = frame;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    outgoing = reduced ? undefined : displayed;
    // Confirm the decoded entry once: photo, metadata, link and progress all
    // change in the same render. Only the old decorative layer fades away.
    displayed = frame;
    image.closest('.hd-feature')?.setAttribute('data-featured-photo-ready', '');
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
      duration: 320,
      easing: 'ease-in-out',
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
  function failed(frame: Frame, image: HTMLImageElement) {
    if (frame.source !== source) return;
    if (frame.fallback) {
      if (frame === displayed)
        image.closest('.hd-feature')?.setAttribute('data-featured-photo-ready', '');
      return;
    }
    frame.fallback = true;
    if (frame === displayed) onfailure(true);
  }
</script>

{#each [...(outgoing ? [outgoing] : []), displayed, ...(pending ? [pending] : [])] as frame (frame.source)}
  {@const framing = frame.fallback ? undefined : frame.framing}
  <img
    data-featured-photo
    data-featured-letterbox={framing &&
    [framing.desktop.fit, framing.mobile.fit].some((fit) => fit === 'auto' || fit === 'contain')
      ? ''
      : undefined}
    data-photo-shape={frame.dimensions
      ? frame.dimensions.width > frame.dimensions.height
        ? 'landscape'
        : frame.dimensions.width < frame.dimensions.height
          ? 'portrait'
          : undefined
      : undefined}
    use:coverPhotoSizes={!frame.fallback && frame.dimensions
      ? { source: frame.source, dimensions: frame.dimensions }
      : undefined}
    style={cropStyle('desktop', framing?.desktop) + cropStyle('mobile', framing?.mobile)}
    use:hydratePhoto={{
      framing: frame.framing,
      defaultY: 53,
      active: frame === displayed,
      enabled: !frame.fallback,
    }}
    src={frame.fallback ? catalogPlaceholder : cardPhoto(frame.source)}
    srcset={frame.fallback ? undefined : cardPhotoSet(frame.source)}
    sizes={featuredPhotoSizesForRatio(
      !frame.fallback && frame.dimensions ? frame.dimensions.width / frame.dimensions.height : 0,
    )}
    width="1600"
    height="1067"
    alt={frame === displayed ? frame.alt : ''}
    aria-hidden={frame !== displayed ? true : undefined}
    class:featured-photo-pending={frame === pending}
    class:featured-photo-outgoing={frame === outgoing}
    fetchpriority="high"
    decoding="async"
    onload={(event) => ready(frame, event.currentTarget as HTMLImageElement)}
    onerror={(event) => failed(frame, event.currentTarget as HTMLImageElement)}
  />
{/each}

<style>
  img {
    object-fit: var(--fit-desktop, cover);
    object-position: var(--focus-desktop, 50% 53%);
    transform-origin: var(--focus-desktop, 50% 53%);
    transform: scale(var(--zoom-desktop, 1));
  }
  img[data-photo-shape='portrait'] {
    --auto-fit: contain;
    --contain-x: 50%;
  }
  img[data-photo-shape='landscape'] {
    --contain-y: 50%;
  }
  @media (max-width: 700px) {
    img {
      object-fit: var(--fit-mobile, cover);
      object-position: var(--focus-mobile, 50% 53%);
      transform-origin: var(--focus-mobile, 50% 53%);
      transform: scale(var(--zoom-mobile, 1));
    }
  }
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
