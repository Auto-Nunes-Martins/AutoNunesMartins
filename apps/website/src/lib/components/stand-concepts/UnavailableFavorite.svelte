<script lang="ts">
  import { ImageOff, X } from 'lucide-svelte';
  import type { SelectedVehicle } from '$lib/selectedVehicles';
  let { entry, position, onremove }: { entry: SelectedVehicle; position: number; onremove: () => void } = $props();
  let failedPhoto = $state<string | null>(null);
  const vehicle = $derived(entry.unavailableVehicle);
  const name = $derived(vehicle ? `${vehicle.brand} ${vehicle.model}` : `Viatura guardada ${position}`);
  const photo = $derived(vehicle?.photo && vehicle.photo !== failedPhoto ? vehicle.photo : null);
</script>

<article class="saved-unavailable">
  <div class="saved-photo">
    {#if photo}
      <img src={photo} alt="" width="112" height="84" loading="lazy" onerror={() => failedPhoto = photo} />
    {:else}
      <span role="img" aria-label="Sem fotografia disponível"><ImageOff size={23} strokeWidth={1.3} aria-hidden="true" /></span>
    {/if}
  </div>
  <div class="saved-identity">
    <h3>{#if vehicle}<a href={`/viaturas/${vehicle.slug}`}>{name}</a>{:else}{name}{/if}</h3>
    {#if vehicle}<p class="saved-year">{vehicle.year}</p>{/if}
    <p class="saved-status">{entry.status === 404 ? 'Já não disponível' : 'Dados por atualizar'}</p>
    {#if !vehicle}<p class="saved-missing">{entry.status === 404 ? 'Identificação já indisponível.' : 'O favorito continua guardado.'}</p>{/if}
  </div>
  <button type="button" onclick={onremove} aria-label={`Remover ${name} dos favoritos`} title="Remover dos favoritos"><X size={18} aria-hidden="true" /></button>
</article>

<style>
  .saved-unavailable { display: grid; grid-template-columns: 112px minmax(0, 1fr) 44px; align-items: center; gap: 18px; padding: 16px 0; border-bottom: 1px solid var(--line); }
  .saved-photo { width: 112px; height: 84px; border-radius: 4px; overflow: hidden; background: color-mix(in srgb, var(--text) 5%, var(--bg)); }
  .saved-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .saved-photo span { display: grid; place-items: center; height: 100%; color: var(--muted); }
  h3 { font-size: 16px; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; margin: 0; }
  a { color: var(--text); text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 4px; }
  p { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--muted); }
  .saved-status { color: var(--text); font-size: 11px; }
  button { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--line); border-radius: 50%; color: var(--muted); background: transparent; cursor: pointer; }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
  @media (hover: hover) { button:hover { color: var(--text); border-color: var(--text); } a:hover { text-decoration-color: var(--text); } }
  @media (max-width: 700px) { .saved-unavailable { grid-template-columns: 88px minmax(0, 1fr) 44px; gap: 12px; } .saved-photo { width: 88px; height: 72px; } h3 { font-size: 14px; } }
</style>
