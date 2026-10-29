<script lang="ts">
  import { ImageOff, RotateCcw, X } from 'lucide-svelte';
  import type { SelectedVehicle } from '$lib/selectedVehicles';
  import SelectionPreview from './SelectionPreview.svelte';
  let { entry, position, retrying, onretry, onremove }: { entry: SelectedVehicle; position: number; retrying: boolean; onretry: () => void; onremove: () => void } = $props();
  const identity = $derived(entry.lastKnownIdentity);
  const name = $derived(identity ? `${identity.brand} ${identity.model}` : `Viatura guardada ${position}`);
  let failedPhoto = $state<string | null>(null);
  const photo = $derived(identity?.photo && identity.photo !== failedPhoto ? identity.photo : null);
</script>

<article class="pending-favorite" aria-busy={retrying}>
  <div class="pending-image">
    {#if identity?.preview}<SelectionPreview preview={identity.preview} />
    {:else if photo}<img src={photo} alt="" onerror={() => failedPhoto = photo} />
    {:else}<ImageOff size={30} strokeWidth={1.2} aria-hidden="true" />{/if}
    <button class="remove" type="button" aria-label={`Remover ${name} dos favoritos`} onclick={onremove}><X size={18} aria-hidden="true" /></button>
  </div>
  <div class="pending-copy">
    <h3>{name}</h3>
    {#if identity}<p class="year">{identity.year}</p>{/if}
    <p role="status">{retrying ? 'A consultar novamente…' : 'Não foi possível consultar esta viatura.'}</p>
    <p class="detail">{identity ? 'A disponibilidade ainda não foi confirmada.' : 'A sua escolha continua guardada.'}</p>
    <button class="retry" type="button" disabled={retrying} onclick={onretry}><RotateCcw size={15} aria-hidden="true" />Tentar novamente</button>
  </div>
</article>

<style>
  .pending-favorite { border: 1px solid var(--line); border-radius: 5px; overflow: hidden; color: var(--text); }
  .pending-image { position: relative; aspect-ratio: 1.4; display: grid; place-items: center; background: color-mix(in srgb, var(--text) 4%, var(--bg)); color: var(--muted); }
  img { width: 100%; height: 100%; object-fit: cover; position: absolute; inset: 0; }
  .pending-image :global(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pending-copy { padding: 22px; }
  h3 { margin: 0 0 14px; font-size: 19px; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
  p { font-size: 13px; line-height: 1.6; margin: 8px 0; }
  .year, .detail { color: var(--muted); font-size: 12px; }
  button { color: inherit; cursor: pointer; font: inherit; }
  .remove { position: absolute; top: 12px; right: 12px; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 50%; background: var(--bg); color: var(--text); }
  .retry { display: inline-flex; align-items: center; gap: 8px; border: 0; border-bottom: 1px solid var(--line); background: transparent; min-height: 44px; font-size: 12px; }
  button:disabled { opacity: .5; cursor: wait; }
  button:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
</style>
