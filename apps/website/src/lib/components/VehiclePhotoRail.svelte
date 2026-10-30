<script lang="ts">
  import { untrack } from 'svelte';
  import { framingStyle } from '@anm/types';
  import type { PublicVehicle } from '$lib/publicVehicles';
  import { publicPhoto } from '$lib/publicVehicles';
  import { sizedPhoto } from '$lib/vehiclePhotoSources';
  import type { PublicGallerySession } from '$lib/publicGallerySession';
  import { publicGalleryPhoto } from '$lib/publicGalleryPhoto';
  import { photoRail } from '$lib/photoRail';
  import GalleryContactSlide from './GalleryContactSlide.svelte';

  let {
    vehicle,
    session,
    index,
    drag,
    fullscreen = false,
    instant = false,
    onOpen,
    onContact,
    onLoading,
  }: {
    vehicle: PublicVehicle;
    session: PublicGallerySession | undefined;
    index: number;
    drag?: number;
    fullscreen?: boolean;
    instant?: boolean;
    onOpen?: () => void;
    onContact: () => void;
    onLoading?: (loading: boolean) => void;
  } = $props();
  const sources = $derived(vehicle.photos.map((_, i) => sizedPhoto(publicPhoto(vehicle, i), 1600)));
  const pending = $state<Record<number, boolean>>({});
  const initialIndex = untrack(() => index);
  $effect(() => {
    onLoading?.(index < sources.length ? (pending[index] ?? true) : false);
  });
  function open(event: MouseEvent) {
    if (
      (event.currentTarget as HTMLElement).closest<HTMLElement>('.photo-rail-track')?.dataset
        .moving !== 'true'
    )
      onOpen?.();
  }
</script>

<div class="photo-rail" class:fullscreen>
  <div
    class="photo-rail-track"
    style:transform={`translate3d(${-initialIndex * 100}%, 0, 0)`}
    use:photoRail={{ index, count: sources.length + 1, drag, fullscreen, instant }}
  >
    {#each sources as src, i (src)}
      <div class="photo-rail-slide" aria-hidden={i !== index} inert={i !== index}>
        {#if fullscreen}
          <img
            src={undefined}
            use:publicGalleryPhoto={{
              src,
              session,
              onLoading: (loading) => (pending[i] = loading),
            }}
            alt={`${vehicle.brand} ${vehicle.model} — fotografia ${i + 1}`}
            loading="eager"
            draggable={false}
          />
        {:else}
          <button type="button" data-swipe-surface onclick={open} tabindex={i === index ? 0 : -1}>
            <img
              {src}
              use:publicGalleryPhoto={{
                src,
                session,
                onLoading: (loading) => (pending[i] = loading),
              }}
              alt={`Ampliar fotografia: ${vehicle.brand} ${vehicle.model} — fotografia ${i + 1}`}
              loading="eager"
              fetchpriority={i === 0 ? 'high' : 'auto'}
              style={framingStyle(vehicle.galleryFraming?.[i] ?? undefined)}
              draggable={false}
            />
          </button>
        {/if}
      </div>
    {/each}
    <div
      class="photo-rail-slide rail-contact"
      aria-hidden={index !== sources.length}
      inert={index !== sources.length}
    >
      <img
        src={fullscreen ? undefined : sources[0]}
        use:publicGalleryPhoto={{ src: sources[0]!, session }}
        alt=""
        loading="eager"
        draggable={false}
      />
      <GalleryContactSlide {onContact} />
    </div>
  </div>
</div>

<style>
  .photo-rail:not(.fullscreen) img { object-position: var(--photo-desktop, 50% 50%); }
  @media (max-width: 700px) { .photo-rail:not(.fullscreen) img { object-position: var(--photo-mobile, 50% 50%); } }
  .photo-rail {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    contain: layout paint;
  }
  .photo-rail-track {
    display: flex;
    width: 100%;
    height: 100%;
    gap: 0;
  }
  .photo-rail-slide {
    position: relative;
    flex: 0 0 100%;
    width: 100%;
    height: 100%;
    min-width: 0;
    overflow: hidden;
  }
  button {
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--red);
    outline-offset: -3px;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    user-select: none;
    -webkit-user-drag: none;
  }
  .fullscreen img {
    object-fit: contain;
  }
  .photo-rail.fullscreen .rail-contact > img {
    object-fit: cover;
  }
</style>
