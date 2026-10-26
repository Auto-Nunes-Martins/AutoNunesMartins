<script lang="ts">
 import {photoAttrs,photoFallback,type SignedVariantPhoto} from "$lib/vehicleImage";
  import { tick, untrack, type Snippet } from 'svelte';
  import { dndzone, TRIGGERS, SOURCES, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { Check, Star, Trash2, LockKeyhole } from 'lucide-svelte';
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
    requirePublicPrincipal = false,
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
    requirePublicPrincipal?:boolean;
  } = $props();
  let items = $state<PhotoOrderItem[]>([]);
  const zoneId = $props.id();
  const duration = 150;
  let suppressSelectionClick = false;
  let columns = $state(1);
  let scrollPort = $state<HTMLDivElement>(undefined!);
  const scrollId = zoneId + '-scroll';
  $effect(() => {
    const path = revealPath;
    if (!dense || !path || !scrollPort) return;
    let cancelled = false, frame=0;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const reveal=() => {
      if (cancelled) return;
      const card = [...scrollPort.querySelectorAll<HTMLElement>('[data-photo-path]')].find(node => node.dataset.photoPath === path);
      if (!card) return;
      const box = scrollPort.getBoundingClientRect(), rect = card.getBoundingClientRect();
      const delta=rect.height > scrollPort.clientHeight ? rect.top - box.top : Math.max(0, rect.bottom - box.bottom + 12);
      scrollPort.scrollTo({top:scrollPort.scrollTop+delta,behavior:'instant'});
    };
    const interrupt=()=>{cancelled=true;cancelAnimationFrame(frame);clearTimeout(timer);};
    const resize=new ResizeObserver(()=>{if(!cancelled){cancelAnimationFrame(frame);frame=requestAnimationFrame(reveal);}});resize.observe(scrollPort);
    scrollPort.addEventListener('pointerdown',interrupt);scrollPort.addEventListener('wheel',interrupt,{passive:true});scrollPort.addEventListener('focusin',interrupt);
    void tick().then(()=>{if(cancelled)return;frame=requestAnimationFrame(reveal);timer=setTimeout(reveal,duration+40);});
    return () => { interrupt();resize.disconnect();scrollPort.removeEventListener('pointerdown',interrupt);scrollPort.removeEventListener('wheel',interrupt);scrollPort.removeEventListener('focusin',interrupt); };
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
    });
  });
  function consider(event: CustomEvent<DndEvent<PhotoOrderItem>>) {
    if (event.detail.info.trigger === TRIGGERS.DRAG_STARTED) suppressSelectionClick = true;
    dragging = event.detail.info.trigger !== TRIGGERS.DRAG_STOPPED;
    items = event.detail.items;
    if (event.detail.info.trigger === TRIGGERS.DRAG_STOPPED) void commitOrder(event.detail.items);
  }
  async function commitOrder(nextItems: PhotoOrderItem[]) {
    const order = committedPhotoOrder(nextItems, allowed);
    if (order) {
      items = order.map((path) => ({ id: path, path }));
      selected = order.filter((path) => selected.includes(path));
      if (onreorder && order.some((path, index) => path !== allowed[index])) {
        const saved = await onreorder(order);
        if (!saved) {
          items = allowed.map((path) => ({ id: path, path }));
          selected = allowed.filter((path) => selected.includes(path));
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
    else selected = [path, ...selected.filter((item) => item !== path)];
  }
  function toggle(path: string, checked: boolean) {
    if (pending || dragging || (!selected.includes(path) && checked && selected.length >= 20))
      return;
    const next = checked ? [...selected, path] : selected.filter((item) => item !== path);
    selected = items.map((item) => item.path).filter((path) => next.includes(path));
  }
  function selectPhoto(path: string) {
    toggle(path, !selected.includes(path));
    onpreview?.(path);
  }
  function photoCardGesture(node: HTMLElement, path: string) {
    let start: { x: number; y: number } | undefined;
    let touchPointer = false;
    let touchClickHandled = false;
    const down = (event: PointerEvent) => {
      suppressSelectionClick = false;
      touchPointer = event.pointerType === 'touch' || event.pointerType === 'pen';
      touchClickHandled = false;
      start = { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 3)
        suppressSelectionClick = true;
    };
    const click = (event: MouseEvent) => {
      if ((event.target as Element).closest('button, input, a')) return;
      const keyboard = event instanceof MouseEvent && event.detail === 0;
      // The drag library synthesizes a click on touchend; some browsers also
      // send a native click. Accept either, once per physical touch sequence.
      if (touchPointer && touchClickHandled && !keyboard) return;
      if (!suppressSelectionClick && !dragging && !pending) {
        if (touchPointer && !keyboard) touchClickHandled = true;
        selectPhoto(path);
      }
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('click', click);
    return {
      update(next: string) {
        path = next;
      },
      destroy() {
        node.removeEventListener('pointerdown', down);
        node.removeEventListener('pointermove', move);
        node.removeEventListener('click', click);
      },
    };
  }
  // Keep normal form controls usable inside a card that is itself draggable.
  function preventPhotoDrag(node: HTMLElement) {
    const stop = (event: Event) => event.stopPropagation();
    node.addEventListener('mousedown', stop);
    node.addEventListener('touchstart', stop, { passive: true });
    return {
      destroy() {
        node.removeEventListener('mousedown', stop);
        node.removeEventListener('touchstart', stop);
      },
    };
  }
</script>

{#if !staged}<p class="hint">
  «No site» mostra uma fotografia já publicada. «Só no CRM» ainda não está publicada.
  Clique em «Incluir no site» ou retire a seleção e {staged ? 'use «Guardar alterações» para aplicar tudo.' : 'guarde a publicação para aplicar.'}
  {staged ? 'Foto principal, ordem e eliminações também estão no rascunho.' : 'A foto principal e a ordem são comuns ao anúncio e ao CRM; a autorização para publicar é explícita.'}
  A fotografia escolhida nos destaques da homepage é independente.
</p>{/if}
{#each selected as path}<input type="hidden" name="publicPhotoPaths" value={path} {form} />{/each}
<div class="photo-grid-shell" class:dense>
<!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrollable region supports keyboard scrolling without expanding.) -->
<div id={scrollId} class="photo-grid-scroll" bind:this={scrollPort} tabindex={dense ? 0 : undefined} role="region" aria-label="Fotografias da viatura">
<div class="photo-grid-frame" use:measureGrid style:--photo-rows={rows}>
{#if addPhoto}<div class="add-photo-slot" style:grid-column={1} style:grid-row={1}>{@render addPhoto()}</div>{/if}
<div
  class="photo-grid"
  aria-label="Ordenar fotografias"
  use:dndzone={{
    items,
    type: 'public-photos-' + zoneId,
    flipDurationMs: duration,
    dragDisabled: pending,
    dropFromOthersDisabled: true,
    delayTouchStart: 180,
    dropTargetStyle: { outline: '2px solid var(--color-red)', outlineOffset: '4px' },
  }}
  onconsider={consider}
  onfinalize={finalize}
>
  {#each items as item, index (item.id)}
    {@const photo = photos.find((photo) => photo.path === item.path)}
    {@const approved = selected.includes(item.path)}
    {@const saved = persisted.includes(item.path)}
    {@const live = saved && published}
    {@const changed = approved !== saved}
    {@const isPrincipal = (primaryPath ?? selected[0]) === item.path}
    {@const principalConflict = isPrincipal && requirePublicPrincipal && !approved}
    <div
      class="photo-card"
      role="listitem"
      class:chosen={approved}
      class:is-cover={(primaryPath ?? selected[0]) === item.path}
      data-photo-path={item.path}
      style:grid-column={((index + (addPhoto ? 1 : 0)) % columns) + 1}
      style:grid-row={Math.floor((index + (addPhoto ? 1 : 0)) / columns) + 1}
      animate:flip={{ duration }}
      aria-label={'Fotografia ' + (index + 1)}
      use:photoCardGesture={item.path}
    >
      {#if photo}<img {...photoAttrs(photo,320,'(max-width:480px) 160px, 210px')} use:photoFallback={photo.url} alt={'Fotografia ' + (index + 1)} draggable="false" />{/if}
      {#if dense}<span class="order-index" aria-hidden="true">{index + 1}</span>{/if}
      {#if isPrincipal}<span class="primary-badge"><Star size={11} fill="currentColor" aria-hidden="true" />{staged && item.path !== persistedCoverPath ? 'Foto principal · por guardar' : 'Foto principal'}</span>{/if}
      <div class="visibility" class:live>
        {#if live}<Check size={17} aria-hidden="true" />{:else}<LockKeyhole size={16} aria-hidden="true" />{/if}
        <strong>{live ? 'No site' : saved ? 'Autorizada · viatura fora do site' : 'Só no CRM'}</strong>
      </div>
      {#if changed}<p class="pending-visibility">{approved ? 'Publicar no site · por guardar' : 'Retirar só do site · por guardar. Mantém-se no CRM.'}</p>{/if}
      {#if principalConflict}<p id={`${zoneId}-principal-conflict`} class="principal-conflict" role="status">Esta é a foto principal. Escolha outra para o anúncio ou volte a incluir esta fotografia.</p>{/if}
      <button
        class="caption"
        type="button"
        role="checkbox"
        disabled={pending || dragging || (!approved && selected.length >= 20)}
        aria-label={`${approved ? 'Selecionada para o site' : 'Incluir no site'}: fotografia ${index + 1}`}
        aria-checked={approved}
        data-error-field={isPrincipal ? 'photoPrincipal' : undefined}
        aria-invalid={principalConflict ? 'true' : undefined}
        aria-describedby={principalConflict ? `${zoneId}-principal-conflict` : undefined}
        onclick={() => selectPhoto(item.path)}
        >{#if approved}<Check size={14} aria-hidden="true" />{/if}{approved ? 'Selecionada para o site' : 'Incluir no site'}</button
      >
      <div
        class="actions"
        use:preventPhotoDrag
        role="group"
        aria-label={'Ações da fotografia ' + (index + 1)}
      >
        {#if onprimary}<button
            type="button"
            disabled={pending || dragging || (primaryPath ?? selected[0]) === item.path}
            aria-label={'Definir fotografia ' + (index + 1) + ' como principal'}
            title="Definir como foto principal"
            onclick={() => setCover(item.path)}><Star size={13} />{dense ? 'Principal' : 'Definir principal'}</button
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
{#if staged && allowed.length}<details class="publication-help"><summary>Como funciona a publicação?</summary><p class="hint">«No site» e «Só no CRM» mostram o estado guardado. «Por guardar» identifica alterações pendentes, mesmo numa fotografia já publicada. A foto principal é a mesma no anúncio e no CRM e tem de estar autorizada para publicar o anúncio. Retirar do site mantém o ficheiro no CRM; o caixote elimina-o do CRM e do site. Só a fotografia escolhida manualmente para o destaque da homepage é independente.</p></details>{/if}

<style>
  .photo-grid-shell {position:relative;}
  .photo-grid-scroll {min-width:0;padding:4px;}
  .dense .photo-grid-scroll {max-height:min(520px,68dvh);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable;}
  .dense .photo-grid-frame {grid-template-columns:repeat(auto-fill,minmax(min(154px,100%),1fr));gap:12px;}
  .dense .photo-card>img {height:100px;}
  .dense .visibility {min-height:32px;padding:6px 8px;font-size:11px;gap:5px;}
  .dense .caption {min-height:40px;padding:7px 8px;font-size:11px;gap:5px;}
  .dense .actions {padding:0 7px 7px;gap:4px;}
  .dense .actions button {min-height:36px;padding:6px;font-size:11px;}
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
    cursor: grab;
    touch-action: pan-y;
    overflow: hidden;
    min-width: 0;
    margin: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-2);
  }
  .chosen {
    border-color: color-mix(in oklab, var(--color-red) 65%, var(--color-border));
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
  .pending-visibility { margin: 0; padding: 8px 10px; font-size: 12px; font-weight: 600; color: var(--color-text); background: color-mix(in srgb, #d9a627 18%, var(--color-bg-1)); border-bottom: 1px dashed #d9a627; }
  .principal-conflict {margin:0;padding:10px;font-size:12px;line-height:1.5;color:var(--color-text);border-bottom:1px solid var(--color-warning);background:var(--color-bg-1);}
  .photo-card:active {
    cursor: grabbing;
  }
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
