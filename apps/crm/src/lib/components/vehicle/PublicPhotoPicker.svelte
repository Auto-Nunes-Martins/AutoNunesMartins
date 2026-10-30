<script lang="ts">
 import {photoAttrs,photoFallback,type SignedVariantPhoto} from "$lib/vehicleImage";
  import { tick, untrack, type Snippet } from 'svelte';
  import { dndzone, TRIGGERS, SOURCES, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { Star, Trash2 } from 'lucide-svelte';
  import { committedPhotoOrder, type PhotoOrderItem } from './photoOrder';
  import PhotoFramingEditor from './PhotoFramingEditor.svelte';
  import { framingStyle, type PhotoFraming } from '@anm/types';
  let {
    selected = $bindable<string[]>([]),
    dragging = $bindable(false),
    allowed,
    photos,
    pending = false,
    persisted = [],
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
    framing = {},
    onframing,
  }: {
    selected: string[];
    dragging?: boolean;
    allowed: string[];
    photos: SignedVariantPhoto[];
    pending?: boolean;
    persisted?: string[];
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
    framing?: Record<string, PhotoFraming>;
    onframing?: (path: string, value: PhotoFraming | undefined) => void | Promise<boolean>;
  } = $props();
  let items = $state<PhotoOrderItem[]>([]);
  let framingPath = $state<string>();
  let framingDraft = $state<PhotoFraming>();
  let framingPanel = $state<HTMLDivElement>();
  $effect(() => { if (framingPath) void tick().then(() => framingPanel?.scrollIntoView({block:'nearest',behavior:'smooth'})); });
  const zoneId = $props.id();
  const duration = 150;

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
  function keepControlsInteractive(node: HTMLElement) {
    const stop = (event: Event) => event.stopPropagation();
    node.addEventListener("mousedown", stop);
    node.addEventListener("touchstart", stop, {passive:true});
    return {destroy(){node.removeEventListener("mousedown",stop);node.removeEventListener("touchstart",stop);}};
  }
  async function setCover(path: string) {
    if (onprimary) await onprimary(path);
  }

</script>

{#if onreorder}<p id={scrollId + '-instructions'} class="sr-only">Arraste o cartão para ordenar, ou use Espaço e as setas. No telemóvel, mantenha premido antes de arrastar.</p>{/if}
{#each selected as path}<input type="hidden" name="vehiclePhotoPaths" value={path} {form} />{/each}
{#if onframing}<p class="crop-hint">As miniaturas mostram o recorte da ficha pública neste ecrã. Use «Enquadrar» para deslocar a fotografia.</p>{/if}
<div class="photo-grid-shell" class:dense>
<!-- svelte-ignore a11y_no_noninteractive_tabindex (The gallery region supports keyboard access.) -->
<div id={scrollId} class="photo-grid-scroll" bind:this={scrollPort} tabindex={dense ? 0 : undefined} role="region" aria-label="Fotografias da viatura">
<div
  class="photo-grid"
  aria-label="Ordenar fotografias"
  use:dndzone={{
    items,
    type: 'public-photos-' + zoneId,
    flipDurationMs: duration,
    dragDisabled: pending || !onreorder,
    delayTouchStart: 350,
    morphDisabled: true,
    dropFromOthersDisabled: true,

    dropTargetStyle: { outline: '2px solid var(--color-red)', outlineOffset: '4px' },
  }}
  onconsider={consider}
  onfinalize={finalize}
>
  {#each items as item, index (item.id)}
    {@const photo = photos.find((photo) => photo.path === item.path)}
    {@const crop = framingPath === item.path ? framingDraft : framing[item.path]}

    {@const saved = persisted.includes(item.path)}

    {@const isPrincipal = (primaryPath ?? selected[0]) === item.path}

    <div
      class="photo-card"
      role="listitem"
      class:is-cover={(primaryPath ?? selected[0]) === item.path}
      data-photo-path={item.path}
      animate:flip={{ duration }}
      aria-label={'Fotografia ' + (index + 1)}
      aria-describedby={onreorder ? scrollId + '-instructions' : undefined}
    >
      <div class="photo-media">
      {#if photo}<img {...photoAttrs(photo,320,'(max-width:480px) 160px, 210px')} style={framingStyle(crop)} use:photoFallback={photo.url} alt={'Fotografia ' + (index + 1)} draggable="false" />{/if}
      <span class="order-index" aria-hidden="true">{index + 1}</span>
      {#if isPrincipal}<span class="primary-badge"><Star size={11} fill="currentColor" aria-hidden="true" />{staged && item.path !== persistedCoverPath ? 'Foto principal · por guardar' : 'Foto principal'}</span>{/if}
      </div>
      <div class="photo-footer">
      {#if !saved && staged}<p class="photo-pending">Por guardar</p>{/if}
      {#if onpreview}<div use:keepControlsInteractive><button class="caption" type="button" disabled={pending || dragging} onclick={() => onpreview?.(item.path)} aria-label={'Ver fotografia ' + (index + 1)}>Ver fotografia</button></div>{/if}
      <div
        class="actions"
        use:keepControlsInteractive
        role="group"
        aria-label={'Ações da fotografia ' + (index + 1)}
      >
        {#if onframing && photo}<button type="button" disabled={pending || dragging} onclick={() => { framingDraft = framing[item.path]; framingPath = framingPath === item.path ? undefined : item.path; }} aria-expanded={framingPath === item.path}>Enquadrar</button>{/if}
        {#if onprimary}<button
            type="button"
            disabled={pending || dragging || (primaryPath ?? selected[0]) === item.path}
            aria-label={'Definir fotografia ' + (index + 1) + ' como principal'}
            title="Definir como foto principal"
            onclick={() => setCover(item.path)}><Star size={16} aria-hidden="true" />Principal</button
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
    </div>
  {/each}
</div>
{#if addPhoto}<div class="add-photo-slot">{@render addPhoto()}</div>{/if}
</div>
</div>
{#if !allowed.length && !staged}<p class="hint">Sem fotografias. Use «Carregar» para adicionar.</p>{/if}
{#if framingPath && onframing}
  {@const photo = photos.find(photo => photo.path === framingPath)}
  {#if photo}<div class="framing-editor" bind:this={framingPanel}><p>Fotografia {allowed.indexOf(photo.path) + 1}{staged ? ' · Aplicar e guardar a ficha para confirmar' : ''}</p><PhotoFramingEditor src={photo.url} value={framingDraft} context="gallery" disabled={pending} onchange={value => framingDraft = value} /><button type="button" disabled={pending} onclick={async () => { const saved = await onframing?.(photo.path, framingDraft); if (saved !== false) framingPath = undefined; }}>Aplicar enquadramento</button><button type="button" disabled={pending} onclick={() => framingPath = undefined}>Cancelar</button></div>{/if}
{/if}
{#if staged && allowed.length}<details class="publication-help"><summary>Como funciona a publicação?</summary><p class="hint">Ao publicar a viatura, todas as fotografias guardadas ficam visíveis no site, pela mesma ordem e com a mesma foto principal. Adicionar, ordenar e eliminar só é aplicado ao guardar. Retirar a viatura do site oculta todas as fotografias. O caixote elimina a fotografia da viatura.</p></details>{/if}

<style>
  .framing-editor {margin:16px auto 0;max-width:760px;} .framing-editor > p {font-size:12px;color:var(--color-text-muted);margin-bottom:8px;} .framing-editor > button {margin:12px 8px 0 0;} .actions {flex-wrap:wrap;}
  .photo-grid-shell, .photo-grid-scroll {min-width:0;}
  .photo-grid-scroll {padding:4px;overflow:visible;}
  .photo-grid {display:grid;grid-template-columns:repeat(auto-fill,minmax(min(198px,100%),1fr));gap:16px;align-items:start;}
  /* Card and child styles also apply to the drag clone outside the gallery. */
  .photo-card {position:relative;min-width:0;margin:0;overflow:hidden;border:1px solid var(--color-border-strong);border-radius:10px;background:var(--color-bg-1);touch-action:pan-y;cursor:grab;box-sizing:border-box;}
  .photo-card.is-cover {border-color:var(--color-warning);}
  .photo-card:focus-visible {outline:2px solid var(--color-red);outline-offset:4px;}
  .crop-hint {font-size:12px;color:var(--color-text-muted);line-height:1.6;margin-bottom:12px;}
  .photo-media {position:relative;aspect-ratio:1.4;background:var(--color-bg-2);overflow:hidden;}
  .photo-media img {position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;object-position:var(--photo-desktop,50% 50%);user-select:none;-webkit-touch-callout:none;}
  @media(max-width:700px) {.photo-media{aspect-ratio:4/3;}.photo-media img{object-position:var(--photo-mobile,50% 50%);}}
  .order-index {position:absolute;top:10px;right:10px;display:grid;place-items:center;min-width:24px;height:24px;padding:0 5px;border-radius:5px;background:var(--color-bg-1);color:var(--color-text);font-size:11px;border:1px solid var(--color-border);}
  .primary-badge {position:absolute;left:10px;bottom:10px;display:inline-flex;align-items:center;gap:5px;max-width:calc(100% - 20px);padding:5px 7px;border-radius:5px;background:var(--color-warning);color:#191000;font-size:10px;line-height:1.4;font-weight:600;}
  .photo-footer {display:flex;flex-direction:column;gap:12px;padding:12px;border-top:1px solid var(--color-border);}
.photo-pending {color:var(--color-text-muted);font-size:11px;line-height:17px;}
  .actions {display:flex;align-items:center;gap:8px;}
  button {display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:38px;padding:8px 10px;border:1px solid var(--color-border);border-radius:6px;background:var(--color-bg-2);color:var(--color-text);font-size:11px;line-height:16px;cursor:pointer;}
  .actions button:not(.delete-photo) {flex:1;}
  .delete-photo {flex:none;min-width:38px;padding:8px;color:var(--color-red);}
  button:disabled {opacity:.5;cursor:default;}
  button:focus-visible,summary:focus-visible,.photo-grid-scroll:focus-visible {outline:2px solid var(--color-red);outline-offset:3px;}
  .caption {width:100%;}
  .add-photo-slot {display:flex;margin-top:16px;}
  .hint {margin:12px 0;color:var(--color-text-muted);font-size:12px;line-height:1.6;}
  .publication-help {margin-top:20px;padding-top:14px;border-top:1px solid var(--color-border);}
  .publication-help summary {display:list-item;width:fit-content;padding:6px 0;color:var(--color-text-muted);font-size:12px;cursor:pointer;}
  @media (hover:hover) {.photo-card:hover {border-color:var(--color-text-muted);}button:not(:disabled):hover {border-color:var(--color-border-strong);}}
  @media (max-width:480px) {.photo-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}.photo-footer {padding:10px;gap:10px;}.actions {gap:6px;}.actions button {min-height:44px;padding-inline:7px;}.delete-photo {min-width:38px;}.primary-badge {left:7px;bottom:7px;font-size:9px;max-width:calc(100% - 14px);}.order-index {top:7px;right:7px;}}
</style>
