<script lang="ts">
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { reorderMotion, revealFraming } from '$lib/reorderMotion';
  import { sessionFetch } from '$lib/auth/session';
  import { crmPath } from '$lib/paths';
  import type { HighlightGalleryPhoto } from '$lib/highlightPhotoRequests';
  import { campaignFraming, type GalleryPhotoFraming, type PhotoFraming } from '@anm/types';
  import PhotoFramingEditor from './PhotoFramingEditor.svelte';
  import PhotoFramingActions from './PhotoFramingActions.svelte';

  let { vehicleId, disabled = false, open = false }: { vehicleId: string; disabled?: boolean; open?: boolean } = $props();
  let photo = $state<HighlightGalleryPhoto & { galleryFraming?: GalleryPhotoFraming }>();
  let value = $state<PhotoFraming>();
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let message = $state('');
  let dirty = $state(false);

  $effect(() => {
    if (open) untrack(() => { void load(); });
  });

  async function load() {
    if (photo || loading) return;
    loading = true;
    error = '';
    try {
      const response = await sessionFetch(crmPath(`/site/destaques/fotografias?viatura=${encodeURIComponent(vehicleId)}`));
      if (!response.ok) throw new Error('Não foi possível carregar a fotografia.');
      const result = await response.json();
      photo = result.photos?.[0];
      if (!photo?.url) {
        photo = undefined;
        throw new Error('A viatura precisa de uma fotografia principal.');
      }
      value = campaignFraming(photo.galleryFraming);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Não foi possível carregar a fotografia.';
    } finally {
      loading = false;
    }
  }

  async function save() {
    if (!photo || saving || disabled) return;
    saving = true;
    error = '';
    message = '';
    try {
      const response = await sessionFetch(crmPath(`/viaturas/${vehicleId}/photos/framing`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: photo.path, destination: 'campaign', framing: value ?? null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível guardar o enquadramento.');
      const saved = result.galleryFraming?.[photo.path];
      value = campaignFraming(saved);
      dirty = false;
      message = 'Enquadramento da oferta guardado.';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Não foi possível guardar o enquadramento.';
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
<div id={`campaign-framing-${vehicleId}`} class="campaign-framing" role="region" aria-label="Enquadrar fotografia da oferta"
  transition:slide={reorderMotion()} onintroend={(event) => { if (open) void revealFraming(event.currentTarget); }}>
    <PhotoFramingEditor
      {photo} src={photo?.url ?? ''} {value} context="campaign" loading={!photo && !error} disabled={disabled || saving || !photo}
      onchange={next => { value = next; dirty = true; message = ''; }}
    >
      {#snippet actions()}
        <PhotoFramingActions label={saving ? 'A guardar…' : 'Guardar enquadramento'}
          note="Aplica os ajustes à fotografia desta oferta."
          disabled={disabled || saving || !dirty || !photo} onsave={save} />
      {/snippet}
    </PhotoFramingEditor>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if error && !photo}<button type="button" onclick={load}>Tentar novamente</button>{/if}
  {#if message}<p role="status">{message}</p>{/if}
</div>
{/if}

<style>
  .campaign-framing { min-width: 0; }
  button { margin-top: 12px; padding: 9px 12px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg-2); color: var(--color-text); font-size: 12px; }
  button:disabled { opacity: .5; }
  p { font-size: 12px; margin-top: 8px; color: var(--color-text-muted); }
  [role='alert'] { color: var(--color-red); }
</style>
