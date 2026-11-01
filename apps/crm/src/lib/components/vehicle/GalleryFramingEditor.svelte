<script lang="ts">
  import { withGalleryDestination, type GalleryPhotoFraming } from '@anm/types';
  import type { SignedVariantPhoto } from '$lib/vehicleImage';
  import PhotoFramingEditor from './PhotoFramingEditor.svelte';
  let {
    photo,
    value,
    isPrincipal,
    disabled = false,
    onchange,
  }: {
    photo: SignedVariantPhoto;
    value?: GalleryPhotoFraming;
    isPrincipal: boolean;
    disabled?: boolean;
    onchange: (value: GalleryPhotoFraming | undefined) => void;
  } = $props();
</script>

<div class="destination-frames" class:principal={isPrincipal}>
  {#if isPrincipal}
    <PhotoFramingEditor
      {photo}
      src={photo.url ?? ''}
      value={value?.card ?? undefined}
      context="card"
      {disabled}
      onchange={(next) => onchange(withGalleryDestination(value, 'card', next))}
    />
  {/if}
  <PhotoFramingEditor
    {photo}
    src={photo.url ?? ''}
    {value}
    context="gallery"
    {disabled}
    onchange={(next) => onchange(withGalleryDestination(value, 'detail', next))}
  />
</div>
<p class="destination-help">
  {isPrincipal
    ? 'O cartão mostra esta fotografia principal. Os dois enquadramentos são independentes.'
    : 'Esta fotografia aparece na ficha pública. Só a fotografia principal aparece no cartão.'} A ampliação
  mostra a fotografia inteira.
</p>

<style>
  .destination-frames {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .destination-frames.principal {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .destination-help {
    font-size: 11px;
    line-height: 1.7;
    color: var(--color-text-muted);
    margin-top: 12px;
  }
  @media (max-width: 700px) {
    .destination-frames.principal {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
