<script lang="ts">
  import { CarFront } from 'lucide-svelte';
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import type { HighlightGalleryPhoto } from '$lib/highlightPhotoRequests';
  import { selectPhoto } from '$lib/reusablePhoto';

  let { vehicleId }: { vehicleId: string } = $props();
  let url = $state<string>();

  $effect(() => {
    const id = vehicleId;
    const controller = new AbortController();
    url = undefined;
    if (!id) return;
    const query = new URLSearchParams({ viatura: id });
    void sessionFetch(crmPath(`/site/destaques/fotografias?${query}`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const { photos } = (await response.json()) as { photos?: HighlightGalleryPhoto[] };
        if (!controller.signal.aborted && Array.isArray(photos)) {
          for (const photo of photos) {
            const thumbnail = selectPhoto(photo, 640);
            if (thumbnail) {
              url = thumbnail.url;
              break;
            }
          }
        }
      })
      .catch(() => {
        // Keep the placeholder when a signed photograph is unavailable.
      });
    return () => controller.abort();
  });
</script>

<span class="cover">
  {#if url}
    <img src={url} alt="" decoding="async" onerror={() => (url = undefined)} />
  {:else}
    <span class="placeholder" aria-hidden="true">
      <CarFront size={34} strokeWidth={1.3} />
      <span>{vehicleId ? 'Sem pré-visualização' : 'Selecione uma viatura'}</span>
    </span>
  {/if}
</span>

<style>
  .cover {
    display: grid;
    aspect-ratio: 16 / 10;
    overflow: hidden;
    border-radius: calc(var(--radius-card) - 4px);
    background: var(--color-bg-0);
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
</style>
