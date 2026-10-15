<script lang="ts">
  import { untrack } from 'svelte';
  import { dndzone, TRIGGERS, SOURCES, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import { Check, Star, Trash2 } from 'lucide-svelte';
  import { committedPhotoOrder, type PhotoOrderItem } from './photoOrder';
  let {
    selected = $bindable<string[]>([]),
    dragging = $bindable(false),
    allowed,
    photos,
    pending = false,
    form,
    primaryPath,
    onprimary,
    onreorder,
    ondelete,
    onpreview,
  }: {
    selected: string[];
    dragging?: boolean;
    allowed: string[];
    photos: { path: string; url: string }[];
    pending?: boolean;
    form?: string;
    primaryPath?: string;
    onprimary?: (path: string) => Promise<void>;
    onreorder?: (paths: string[]) => Promise<boolean>;
    ondelete?: (path: string) => Promise<void>;
    onpreview?: (path: string) => void;
  } = $props();
  let items = $state<PhotoOrderItem[]>([]);
  const zoneId = $props.id();
  const duration = 150;
  let suppressSelectionClick = false;
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
    const down = (event: PointerEvent) => {
      suppressSelectionClick = false;
      start = { x: event.clientX, y: event.clientY };
    };
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 3)
        suppressSelectionClick = true;
    };
    const click = (event: MouseEvent) => {
      if ((event.target as Element).closest('button, input, a')) return;
      if (!suppressSelectionClick && !dragging && !pending) selectPhoto(path);
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

<p class="hint">
  Clique num cartão para incluir ou retirar do site. Arraste para ordenar; no telemóvel, mantenha
  pressionado antes de arrastar. A capa fica na primeira posição; o site usa a primeira fotografia
  selecionada. A ordem e a capa são guardadas de imediato. Guarde a publicação para aplicar a
  seleção.
</p>
{#each selected as path}<input type="hidden" name="publicPhotoPaths" value={path} {form} />{/each}
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
    <div
      class="photo-card"
      role="listitem"
      class:chosen={approved}
      animate:flip={{ duration }}
      aria-label={'Fotografia ' + (index + 1)}
      use:photoCardGesture={item.path}
    >
      {#if photo}<img src={photo.url} alt={'Fotografia ' + (index + 1)} draggable="false" />{/if}
      {#if (primaryPath ?? selected[0]) === item.path}<span class="primary-badge">Capa</span>{/if}
      <button
        class="caption"
        type="button"
        disabled={pending || dragging || (!approved && selected.length >= 20)}
        aria-label={'Mostrar fotografia ' + (index + 1) + ' no site'}
        aria-pressed={approved}
        onclick={() => selectPhoto(item.path)}
        >{#if approved}<Check size={14} />{/if}{approved ? 'Visível no site' : 'Só no CRM'}</button
      >
      <div
        class="actions"
        use:preventPhotoDrag
        role="group"
        aria-label={'Ações da fotografia ' + (index + 1)}
      >
        {#if onprimary || approved}<button
            type="button"
            disabled={pending || dragging || (primaryPath ?? selected[0]) === item.path}
            aria-label={'Definir fotografia ' + (index + 1) + ' como capa'}
            onclick={() => setCover(item.path)}><Star size={13} />Definir capa</button
          >{/if}
        {#if ondelete}<button
            type="button"
            class="delete-photo"
            disabled={pending || dragging}
            aria-label={'Eliminar fotografia ' + (index + 1)}
            onclick={() => ondelete?.(item.path)}><Trash2 size={14} /></button
          >{/if}
      </div>
    </div>
  {/each}
</div>
{#if !allowed.length}<p class="hint">Sem fotografias. Use «Carregar» para adicionar.</p>{/if}

<style>
  .hint {
    margin: 12px 0;
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.6;
  }
  .photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(180px, 100%), 1fr));
    gap: 14px;
    min-height: 12px;
    border-radius: var(--radius-card);
  }
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
  .photo-card > img {
    display: block;
    width: 100%;
    height: 130px;
    object-fit: cover;
    user-select: none;
  }
  .caption {
    /* Pointer gestures belong to the whole card; this remains a native keyboard action. */
    pointer-events: none;
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
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 3px 5px;
    background: var(--color-bg-1);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    border-radius: 3px;
    font-size: 9px;
  }
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
    .actions button {
      min-height: 40px;
      min-width: 32px;
      padding: 6px;
      font-size: 10px;
    }
    .photo-grid {
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
