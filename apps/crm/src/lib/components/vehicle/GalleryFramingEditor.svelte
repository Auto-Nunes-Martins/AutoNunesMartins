<script lang="ts">
  import type { Snippet } from 'svelte';
  import { LayoutGrid, Images } from 'lucide-svelte';
  import { withGalleryDestination, type GalleryPhotoFraming } from '@anm/types';
  import type { SignedVariantPhoto } from '$lib/vehicleImage';
  import PhotoFramingEditor from './PhotoFramingEditor.svelte';
  let {
    photo,
    value,
    isPrincipal,
    disabled = false,
    onchange,
    actions,
  }: {
    photo: SignedVariantPhoto;
    value?: GalleryPhotoFraming;
    isPrincipal: boolean;
    disabled?: boolean;
    onchange: (value: GalleryPhotoFraming | undefined) => void;
    actions?: Snippet;
  } = $props();
  let destination = $state<'card' | 'detail'>('card');
  const selected = $derived(isPrincipal ? destination : 'detail');
</script>

<div class="destination-frames">
  {#snippet destinations()}
    <div class="destinations" role="group" aria-label="Destino do enquadramento">
      <button
        type="button"
        aria-label="Cartão da viatura"
        aria-pressed={selected === 'card'}
        onclick={() => (destination = 'card')}
      >
        <LayoutGrid size={16} aria-hidden="true" />
        <span>Cartão da viatura</span>
      </button>
      <button
        type="button"
        aria-label="Imagem na galeria"
        aria-pressed={selected === 'detail'}
        onclick={() => (destination = 'detail')}
      >
        <Images size={16} aria-hidden="true" />
        <span>Imagem na galeria</span>
      </button>
    </div>
  {/snippet}
  <PhotoFramingEditor
    {actions}
    destinations={isPrincipal ? destinations : undefined}
    {photo}
    src={photo.url ?? ''}
    value={selected === 'card' ? (value?.card ?? undefined) : value}
    context={selected === 'card' ? 'card' : 'gallery'}
    {disabled}
    onchange={(next) => onchange(withGalleryDestination(value, selected, next))}
  />
</div>

<style>
  .destination-frames {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .destinations {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 56px;
    margin-bottom: -1px;
    padding: 15px 20px;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 8px 8px 0 0;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 14px;
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
    font-weight: 500;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }
  button:hover {
    background: var(--color-bg-2);
    color: var(--color-text);
  }
  button[aria-pressed='true'] {
    color: var(--color-text);
    border-bottom-color: var(--color-red);
    background: color-mix(in srgb, var(--color-red) 4%, var(--color-bg-1));
  }
  button[aria-pressed='true']:hover {
    background: color-mix(in srgb, var(--color-red) 7%, var(--color-bg-1));
  }
  button[aria-pressed='true'] > :global(svg) {
    color: var(--color-red);
  }
  button:focus-visible {
    outline: 2px solid var(--color-text-muted);
    outline-offset: 3px;
  }
  button > :global(svg) {
    flex: none;
  }
  @media (max-width: 500px) {
    button {
      padding: 13px 10px;
      font-size: 13px;
      gap: 8px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
