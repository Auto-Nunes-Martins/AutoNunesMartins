<script lang="ts">
 import {photoAttrs,photoFallback,type SignedVariantPhoto} from "$lib/vehicleImage";
  import { tick, untrack, type Snippet } from 'svelte';
  import { dragHandleZone, dragHandle, TRIGGERS, SOURCES, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { Check, Star, Trash2, GripVertical } from 'lucide-svelte';
  import { committedPhotoOrder, type PhotoOrderItem } from './photoOrder';
  let {
    selected = $bindable<string[]>([]),
    dragging = $bindable(false),
    allowed,
    photos,
    pending = false,
    persisted = [],
    published = false,
    staged = false,
    form,
    primaryPath,
    onprimary,
    onreorder,
    ondelete,
    onpreview,
    addPhoto,
    dense = false,
    revealPath,
    persistedCoverPath,
  }: {
    selected: string[];
    dragging?: boolean;
    allowed: string[];
    photos: SignedVariantPhoto[];
    pending?: boolean;
    persisted?: string[];
    published?: boolean;
    staged?: boolean;
    form?: string;
    primaryPath?: string;
    onprimary?: (path: string) => Promise<void>;
    onreorder?: (paths: string[]) => Promise<boolean>;
    ondelete?: (path: string) => Promise<void>;
    onpreview?: (path: string) => void;
    addPhoto?: Snippet;
    dense?: boolean;
    revealPath?: string;
    persistedCoverPath?: string;
  } = $props();
  let items = $state<PhotoOrderItem[]>([]);
  const zoneId = $props.id();
  const duration = 150;

  let columns = $state(1);
  let scrollPort = $state<HTMLDivElement>(undefined!);
  const scrollId = zoneId + '-scroll';
  $effect(() => {
    const path = revealPath;
    if (!path) return;
    void tick().then(() => {
      const card = [...scrollPort.querySelectorAll<HTMLElement>('[data-photo-path]')].find(node => node.dataset.photoPath === path);
      card?.scrollIntoView({block:'nearest',behavior:'instant'});
    });
  });
  const rows = $derived(Math.max(1, Math.ceil((items.length + (addPhoto ? 1 : 0)) / columns)));
  function measureGrid(node: HTMLElement) {
    const measure = () => { columns = getComputedStyle(node).gridTemplateColumns.split(' ').length; };
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return { destroy() { observer.disconnect(); } };
  }
  $effect(() => {
    const available = allowed;
    untrack(() => {
      if (dragging) return;
      items = available.map((path) => ({ id: path, path }));
      selected = [...available];
    });
  });
  function consider(event: CustomEvent<DndEvent<PhotoOrderItem>>) {

    dragging = event.detail.info.trigger !== TRIGGERS.DRAG_STOPPED;
    items = event.detail.items;
    if (event.detail.info.trigger === TRIGGERS.DRAG_STOPPED) void commitOrder(event.detail.items);
  }
  async function commitOrder(nextItems: PhotoOrderItem[]) {
    const order = committedPhotoOrder(nextItems, allowed);
    if (order) {
      items = order.map((path) => ({ id: path, path }));
      selected = [...order];
      if (onreorder && order.some((path, index) => path !== allowed[index])) {
        const saved = await onreorder(order);
        if (!saved) {
          items = allowed.map((path) => ({ id: path, path }));
          selected = [...allowed];
        }
      }
    } else items = allowed.map((path) => ({ id: path, path }));
    dragging = false;
  }
  function finalize(event: CustomEvent<DndEvent<PhotoOrderItem>>) {
    if (event.detail.info.source === SOURCES.KEYBOARD) {
      items = event.detail.items;
      return;
    }
    void commitOrder(event.detail.items);
  }
  async function setCover(path: string) {
    if (onprimary) await onprimary(path);
  }

</script>

<p class="hint">Todas as fotografias acompanham a publicação global da viatura. A primeira é a foto principal. Use a pega para ordenar; a fotografia dos destaques da homepage é independente.</p>
{#each selected as path}<input type="hidden" name="vehiclePhotoPaths" value={path} {form} />{/each}
<div class="photo-grid-shell" class:dense>
<!-- svelte-ignore a11y_no_noninteractive_tabindex (The gallery region supports keyboard access.) -->
<div id={scrollId} class="photo-grid-scroll" bind:this={scrollPort} tabindex={dense ? 0 : undefined} role="region" aria-label="Fotografias da viatura">
<div class="photo-grid-frame" use:measureGrid style:--photo-rows={rows}>
{#if addPhoto}<div class="add-photo-slot" style:grid-column={1} style:grid-row={1}>{@render addPhoto()}</div>{/if}
<div
  class="photo-grid"
  aria-label="Ordenar fotografias"
  use:dragHandleZone={{
    items,
    type: 'public-photos-' + zoneId,
    flipDurationMs: duration,
    dragDisabled: pending,
    dropFromOthersDisabled: true,

    dropTargetStyle: { outline: '2px solid var(--color-red)', outlineOffset: '4px' },
  }}
  onconsider={consider}
  onfinalize={finalize}
>
  {#each items as item, index (item.id)}
    {@const photo = photos.find((photo) => photo.path === item.path)}

    {@const saved = persisted.includes(item.path)}
    {@const live = saved && published}

    {@const isPrincipal = (primaryPath ?? selected[0]) === item.path}

    <div
      class="photo-card"
      role="listitem"
      class:is-cover={(primaryPath ?? selected[0]) === item.path}
      data-photo-path={item.path}
      style:grid-column={((index + (addPhoto ? 1 : 0)) % columns) + 1}
      style:grid-row={Math.floor((index + (addPhoto ? 1 : 0)) / columns) + 1}
      animate:flip={{ duration }}
      aria-label={'Fotografia ' + (index + 1)}
    >
      {#if photo}<img {...photoAttrs(photo,320,'(max-width:480px) 160px, 210px')} use:photoFallback={photo.url} alt={'Fotografia ' + (index + 1)} draggable="false" />{/if}
      {#if dense}<span class="order-index" aria-hidden="true">{index + 1}</span>{/if}
      {#if isPrincipal}<span class="primary-badge"><Star size={11} fill="currentColor" aria-hidden="true" />{staged && item.path !== persistedCoverPath ? 'Foto principal · por guardar' : 'Foto principal'}</span>{/if}
      <div class="visibility" class:live>
        {#if live}<Check size={17} aria-hidden="true" />{/if}
        <strong>{!saved && staged ? 'Por guardar' : published ? 'No site' : 'Acompanha a publicação'}</strong>
      </div>
      {#if onpreview}<button class="caption" type="button" disabled={pending || dragging} onclick={() => onpreview?.(item.path)} aria-label={'Ver fotografia ' + (index + 1)}>Ver fotografia</button>{/if}
      <div
        class="actions"
        role="group"
        aria-label={'Ações da fotografia ' + (index + 1)}
      >
        {#if onreorder}<div class="drag-handle" role="button" tabindex="0" use:dragHandle aria-disabled={pending} aria-label={'Ordenar fotografia ' + (index + 1)} title="Arrastar para ordenar · Espaço e setas por teclado"><GripVertical size={16} aria-hidden="true" /></div>{/if}
        {#if onprimary}<button
            type="button"
            disabled={pending || dragging || (primaryPath ?? selected[0]) === item.path}
            aria-label={'Definir fotografia ' + (index + 1) + ' como principal'}
            title="Definir como foto principal"
            onclick={() => setCover(item.path)}><Star size={16} aria-hidden="true" />{dense ? '' : 'Definir principal'}</button
          >{/if}
        {#if ondelete}<button
            type="button"
            class="delete-photo"
            disabled={pending || dragging}
            aria-label={'Eliminar fotografia ' + (index + 1)}
            title={staged ? 'Eliminar do CRM e do site ao guardar' : 'Eliminar fotografia do CRM e do site'}
            onclick={() => ondelete?.(item.path)}><Trash2 size={14} /></button
          >{/if}
      </div>
    </div>
  {/each}
</div>
</div>
</div>
</div>
{#if !allowed.length && !staged}<p class="hint">Sem fotografias. Use «Carregar» para adicionar.</p>{/if}
{#if staged && allowed.length}<details class="publication-help"><summary>Como funciona a publicação?</summary><p class="hint">Ao publicar a viatura, todas as fotografias guardadas ficam visíveis no site, pela mesma ordem e com a mesma foto principal. Adicionar, ordenar e eliminar só é aplicado ao guardar. Retirar a viatura do site oculta todas as fotografias. O caixote elimina a fotografia da viatura.</p></details>{/if}

<style>
  .photo-grid-shell {position:relative;}
  .photo-grid-scroll {min-width:0;padding:4px;}
  .dense .photo-grid-scroll {overflow:visible;}
  .dense .photo-grid-frame {grid-template-columns:repeat(auto-fill,minmax(min(154px,100%),1fr));gap:12px;}
  .dense .photo-card>img {height:100px;}
  .dense .visibility {min-height:32px;padding:6px 8px;font-size:11px;gap:5px;}
  .dense .caption {min-height:40px;padding:7px 8px;font-size:11px;gap:5px;}
  .dense .actions {padding:0 7px 7px;gap:4px;}
  .dense .actions button {min-width:36px;min-height:36px;padding:6px;font-size:11px;}
  @media (pointer:coarse) {.dense .actions button {min-width:44px;min-height:44px;}}
  .order-index {position:absolute;top:6px;right:6px;display:grid;place-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:3px;background:var(--color-bg-1);color:var(--color-text);font-size:10px;border:1px solid var(--color-border);}
  .dense .primary-badge {max-width:calc(100% - 38px);font-size:9px;}
  .photo-grid-scroll:focus-visible {outline:2px solid var(--color-red);outline-offset:2px;}
  .hint {
    margin: 12px 0;
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.6;
  }
  .publication-help { margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--color-border); }
  .publication-help summary { display: list-item; width: fit-content; padding: 6px 0; color: var(--color-text-muted); font-size: 12px; cursor: pointer; }
  .publication-help summary:focus-visible { outline: 2px solid var(--color-red); outline-offset: 4px; }
  .photo-grid-frame {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
    gap: 14px;
    min-height: 12px;
    border-radius: var(--radius-card);
  }
  .photo-grid { display:grid; grid-template-columns:subgrid; grid-template-rows:subgrid; grid-column:1 / -1; grid-row:1 / span var(--photo-rows); gap:inherit; min-height:12px; }
  .add-photo-slot { min-width:0; display:flex; z-index:1; }
  .photo-card {
    position: relative;
    cursor: default;
    touch-action: pan-y;
    overflow: hidden;
    min-width: 0;
    margin: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-2);
  }
  .photo-card.is-cover { border-color:var(--color-warning); }
  .photo-card > img {
    display: block;
    width: 100%;
    height: 130px;
    object-fit: cover;
    user-select: none;
  }
  .caption {
    /* Pointer gestures belong to the whole card; this remains a native keyboard action. */
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    gap: 8px;
    padding: 12px;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: 12px;
    cursor: pointer;
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
    padding: 0 10px 10px;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 36px;
    padding: 6px 8px;
    background: var(--color-bg-1);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
  }
  .primary-badge {
    max-width:calc(100% - 12px);
    line-height:1.3;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 3px 5px;
    background: color-mix(in srgb, var(--color-warning) 75%, #ffd978);
    color: #191000;
    border: 1px solid var(--color-warning);
    border-radius: 3px;
    font-size: 9px;
  }
  .visibility { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 10px; background: var(--color-bg-2); border-bottom: 1px solid var(--color-border); color: var(--color-text-muted); font-size: 12px; }
  .visibility.live { color: var(--color-text); background: color-mix(in srgb, #1e9c67 20%, var(--color-bg-1)); border-bottom-color: #1e9c67; }
  .drag-handle { display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:36px;border:1px solid var(--color-border);border-radius:4px;background:var(--color-bg-1);cursor:grab;touch-action:none; }
  .drag-handle:focus-visible {outline:2px solid var(--color-red);outline-offset:3px;}
  @media (pointer:coarse) {.drag-handle {min-width:44px;min-height:44px;}}
  .drag-handle:active { cursor: grabbing; }
  .delete-photo {
    margin-left: auto;
    color: var(--color-red);
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  :is(button, input):focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  @media (max-width: 480px) {
    .dense .photo-grid-frame {grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
    .dense .photo-card>img {height:86px;}
    .dense .actions button,.dense .caption {min-height:44px;}
    .actions button {
      min-height: 40px;
      min-width: 32px;
      padding: 6px;
      font-size: 10px;
    }
    .photo-grid-frame {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .actions {
      padding-inline: 8px;
    }
    .photo-card > img {
      height: 110px;
    }
  }
</style>
