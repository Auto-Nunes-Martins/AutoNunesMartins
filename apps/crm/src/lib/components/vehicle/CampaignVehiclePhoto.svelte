<script lang="ts">
  import { CarFront } from 'lucide-svelte';
  import { photoFraming, type PhotoFraming } from '@anm/types';
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import type { HighlightGalleryPhoto } from '$lib/highlightPhotoRequests';
  import { selectPhoto } from '$lib/reusablePhoto';
  import { photoFallback } from '$lib/vehicleImage';

  let { vehicleId, compact = false }: { vehicleId: string; compact?: boolean } = $props();
  let cover = $state<{ url: string; original: string | null; framing?: PhotoFraming }>();
  let inView = $state(false);

  function watchVisibility(node: HTMLElement) {
    if (!compact || typeof IntersectionObserver === 'undefined') {
      inView = true;
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      inView = true;
      observer.disconnect();
    });
    observer.observe(node);
    return { destroy: () => observer.disconnect() };
  }

  $effect(() => {
    const id = vehicleId;
    const controller = new AbortController();
    cover = undefined;
    if (!id || (compact && !inView)) return;
    const targetWidth = compact ? 240 : 900;
    const query = new URLSearchParams({ viatura: id });
    void sessionFetch(crmPath(`/site/destaques/fotografias?${query}`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const { photos } = (await response.json()) as {
          photos?: (HighlightGalleryPhoto & { coverFraming?: PhotoFraming })[];
        };
        const photo = Array.isArray(photos) ? photos[0] : undefined;
        if (!controller.signal.aborted && photo) {
          const thumbnail = selectPhoto(photo, targetWidth);
          if (thumbnail)
            cover = { url: thumbnail.url, original: photo.url, framing: photo.coverFraming };
        }
      })
      .catch(() => {
        // Keep the placeholder when a signed photograph is unavailable.
      });
    return () => controller.abort();
  });
</script>

<span class="cover" class:compact use:watchVisibility>
  {#if cover}
    <img
      src={cover.url}
      use:photoFallback={cover.original}
      use:photoFraming={{ framing: cover.framing }}
      alt=""
      decoding="async"
      onerror={() => (cover = undefined)}
    />
  {:else}
    <span class="placeholder" aria-hidden="true">
      <CarFront size={compact ? 18 : 34} strokeWidth={1.3} />
      {#if !compact}<span>Sem pré-visualização</span>{/if}
    </span>
  {/if}
</span>

<style>
  .cover {
    position: relative;
    width: 100%;
    display: grid;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: calc(var(--radius-card) - 4px);
    background: var(--color-bg-0);
  }
  .cover.compact {
    aspect-ratio: 4 / 3;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: var(--photo-desktop, 50% 50%);
  }
  @media (max-width: 700px) {
    img {
      object-position: var(--photo-mobile, 50% 50%);
    }
  }
  .placeholder {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 10px;
    padding: 16px;
    color: var(--color-text-muted);
    font-size: 12px;
  }
  .compact .placeholder {
    padding: 0;
  }
</style>
