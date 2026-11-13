<script lang="ts">
  import { flip } from 'svelte/animate';
  import { slide } from 'svelte/transition';
  import { reorderMotion, revealFraming } from '$lib/reorderMotion';
  import { selectPhoto } from '$lib/reusablePhoto';
  import { framingStyle, photoFraming, type PhotoFraming } from '@anm/types';
  import { photoFallback } from '$lib/vehicleImage';
  import PhotoFramingEditor from './PhotoFramingEditor.svelte';
  import PhotoFramingActions from './PhotoFramingActions.svelte';
  import VehicleCatalogue from './VehicleCatalogue.svelte';
  import { crmPath } from '$lib/paths';
  import { untrack, onMount } from 'svelte';
  import { enhance } from '$lib/auth/enhance';
  import { sessionFetch } from '$lib/auth/session';
  import { tick } from 'svelte';
  import { formFeedback, markFormSaved, refreshFormFeedback } from '$lib/forms/formFeedback';
  import { prepareVehicleHighlight, principalHighlightItems } from '$lib/highlightSelection';
  import { toast } from 'svelte-sonner';
  import { siteSavedFeedback, type SiteSaveSummary } from '../site/siteSaveFeedback';
  import { Star, Image, RefreshCw } from 'lucide-svelte';
  import SelectionOrderActions from '../site/SelectionOrderActions.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import Skeleton from '$lib/components/common/Skeleton.svelte';
  import HomepageHighlightsSkeleton from './HomepageHighlightsSkeleton.svelte';
  import { featuredFramingPosition, featuredFramingRatio, type HighlightsEditor, type HighlightItem } from '$lib/homepageHighlights';
  import { createHighlightPhotoRequests, decodeHighlightPreview, type HighlightGalleryPhoto, type HighlightGalleryState, type HighlightPreview } from '$lib/highlightPhotoRequests';

  let {
    editor,
    selectedVehicleId = null,
  }: { editor: HighlightsEditor; selectedVehicleId?: string | null } = $props();
  let items = $state<HighlightItem[]>(untrack(() => principalHighlightItems(editor)));
  let savedItems = $state<HighlightItem[]>(untrack(() => principalHighlightItems(editor)));
  function saveSummary(submitted: HighlightItem[]): SiteSaveSummary {
    const previous = new Map(savedItems.map(item => [item.vehicleId, item]));
    const next = new Map(submitted.map(item => [item.vehicleId, item]));
    const modified = submitted.filter(item => JSON.stringify(previous.get(item.vehicleId)) !== JSON.stringify(item));
    const removed = savedItems.filter(item => !next.has(item.vehicleId));
    const orderChanged = !modified.length && !removed.length && submitted.some((item, index) => savedItems[index]?.vehicleId !== item.vehicleId);
    if (modified.length + removed.length === 1 && !orderChanged) {
      const item = modified[0] ?? removed[0]!;
      const vehicle = editor.candidates.find(vehicle => vehicle.id === item.vehicleId);
      const removing = !next.has(item.vehicleId);
      const position = featuredFramingPosition(item.framing, 'desktop');
      return { kind: 'highlight', title: removing ? 'Viatura retirada dos destaques' : previous.has(item.vehicleId) ? 'Destaque atualizado' : 'Viatura adicionada aos destaques', label: vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.year}` : 'Destaque da homepage', imageUrl: previews[item.photoPath]?.url ?? undefined, imagePosition: `${position.x}% ${position.y}%`, detail: removing ? 'A seleção da homepage foi guardada.' : `Posição ${submitted.indexOf(item) + 1} na homepage · Fotografia e enquadramento guardados.` };
    }
    return { kind: 'highlight', title: 'Destaques da homepage guardados', label: orderChanged ? 'Ordem dos destaques atualizada' : `${modified.length + removed.length} alterações guardadas`, detail: submitted.length ? `${submitted.length} ${submitted.length === 1 ? 'viatura em destaque.' : 'viaturas em destaque.'}` : 'A seleção de destaques ficou vazia.' };
  }
  let revision = $state(untrack(() => editor.revision));
  let query = $state('');
  let saving = $state(false);
  let message = $state('');
  let choosing = $state<string | null>(null);
  let reordering = $state(false);
  let mounted = $state(false);
  let appliedContext = '';
  let contextMessage = $state('');
  let selectionForm: HTMLFormElement;
  let editorGrid: HTMLDivElement;
  let preparing = $state(true);
  let initialPaths = $state<string[]>([]);
  const initialScope = new AbortController();
  let previews = $state.raw<Partial<Record<string, HighlightPreview | null>>>({});
  let galleries = $state.raw<Record<string, HighlightGalleryState>>({});
  async function fetchPhotos<T>(query: URLSearchParams, signal: AbortSignal): Promise<T[]> {
    const response = await sessionFetch(crmPath(`/site/destaques/fotografias?${query}`), { signal });
    if (!response.ok) throw new Error('Não foi possível carregar as fotografias.');
    const { photos } = (await response.json()) as { photos?: T[] };
    if (!Array.isArray(photos)) throw new Error('Resposta de fotografias inválida.');
    return photos;
  }
  const requests = createHighlightPhotoRequests({
    previews: (paths, signal) => fetchPhotos<HighlightPreview>(new URLSearchParams(paths.map((path) => ['path', path])), signal),
    gallery: (id, signal) => fetchPhotos<HighlightGalleryPhoto>(new URLSearchParams({ viatura: id }), signal),
    onPreview: (path, photo) => {
      if (photo || !previews[path]) previews = { ...previews, [path]: photo };
    },
    onGallery: (id, state) => {
      galleries = { ...galleries, [id]: state };
      if (state.status !== 'ready') return;
      const principal = state.photos[0]?.path;
      if (principal) items = items.map(item => item.vehicleId === id && item.photoPath !== principal ? { vehicleId: id, photoPath: principal } : item);
      const available = { ...previews };
      for (const photo of state.photos) {
        const thumbnail = selectPhoto(photo, 320);
        if (!available[photo.path] && thumbnail) {
          available[photo.path] = { path: photo.path, url: thumbnail.url, originalUrl: photo.url };
          requests.rememberPreview(photo.path);
        }
      }
      previews = available;
    },
  });
  function observePreview(node: HTMLElement, initial: string | undefined) {
    let path = initial;
    let visible = false;
    function request() {
      if (!preparing && visible && path && previews[path] !== null) requests.preview(path);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      request();
    });
    observer.observe(node);
    return { update(next: string | undefined) { path = next; request(); }, destroy() { observer.disconnect(); } };
  }
  async function prepareInitialPreviews() {
    const paths = [...new Set([
      ...principalHighlightItems(editor).flatMap((item) => editor.candidates.some((vehicle) =>
        vehicle.id === item.vehicleId && vehicle.photoPaths.includes(item.photoPath)) ? [item.photoPath] : []),
      ...editor.candidates.flatMap((vehicle) => vehicle.photoPaths.slice(0, 1)),
    ])];
    initialPaths = paths;
    const signal = AbortSignal.any([initialScope.signal, AbortSignal.timeout(12_000)]);
    const resolved = new Map<string, string | null>();
    try {
      await requests.preparePreviews(paths, signal);
      if (initialScope.signal.aborted) return;
      await tick();
      await Promise.all([...editorGrid.querySelectorAll<HTMLImageElement>('img[data-highlight-preview]')].map(async (image) => {
        const path = image.dataset.highlightPreview!;
        const source = await decodeHighlightPreview(image, previews[path]?.originalUrl ?? null, signal);
        if (resolved.get(path) !== null) resolved.set(path, source);
      }));
    } catch {
      // Any thumbnail still unresolved below gets a local retry control.
    } finally {
      if (!initialScope.signal.aborted) {
        const next = { ...previews };
        for (const path of paths) {
          const url = resolved.get(path);
          const preview = next[path];
          next[path] = url && preview ? { ...preview, url } : null;
        }
        previews = next;
        preparing = false;
      }
    }
  }
  onMount(() => {
    mounted = true;
    void prepareInitialPreviews();
    return () => { initialScope.abort(); requests.destroy(); };
  });
  $effect(() => {
    const id = choosing;
    if (id) void untrack(() => requests.gallery(id));
  });
  $effect(() => {
    items = principalHighlightItems(editor);
    savedItems = principalHighlightItems(editor);
    revision = editor.revision;
  });
  $effect(() => {
    const id = selectedVehicleId;
    if (!mounted || preparing || !id || id === appliedContext) return;
    untrack(() => {
      appliedContext = id;
      const prepared = prepareVehicleHighlight(editor, id);
      items = prepared.items;
      choosing = null;
      contextMessage = prepared.message;
      const vehicle = editor.candidates.find((candidate) => candidate.id === id);
      if (!prepared.choosing && vehicle) query = `${vehicle.brand} ${vehicle.model}`;
      void tick().then(() => {
        if (selectionForm) refreshFormFeedback(selectionForm);
        const row = selectionForm?.parentElement?.querySelector<HTMLElement>(
          `[data-highlight-vehicle="${CSS.escape(id)}"]`,
        );
        row?.scrollIntoView({ block: 'center' });
        row?.querySelector<HTMLButtonElement>('button.frame-photo')?.focus({ preventScroll: true });
      });
    });
  });
  const dirty = $derived(JSON.stringify(items) !== JSON.stringify(savedItems));
  const filtered = $derived(
    editor.candidates.filter((vehicle) =>
      `${vehicle.brand} ${vehicle.model} ${vehicle.year}`
        .toLocaleLowerCase('pt-PT')
        .includes(query.toLocaleLowerCase('pt-PT')),
    ),
  );
  function add(vehicleId: string, photoPath: string) {
    if (items.length >= 5 || items.some((item) => item.vehicleId === vehicleId)) return;
    reordering = false;
    items = [...items, { vehicleId, photoPath }];
    choosing = vehicleId;
  }
  function move(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    reordering = true;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    items = next;
  }

  function toggleFraming(id: string) {
    reordering = false;
    choosing = choosing === id ? null : id;
  }

  function remove(index: number) {
    reordering = true;
    items = items.filter((_, i) => i !== index);
  }
</script>

{#snippet preview(path: string | undefined, alt: string, framing?: PhotoFraming, defaultY = 53)}
  {@const thumbnail = path ? previews[path] : undefined}
  {#if thumbnail?.url}
    <img src={thumbnail.url} use:photoFallback={preparing ? null : thumbnail.originalUrl} {alt}
      data-highlight-preview={path}
      use:photoFraming={{ framing, defaultY }} decoding="async"
      onerror={() => { if (path && !preparing) previews = { ...previews, [path]: null }; }} />
  {:else if path && thumbnail === null}
    <button type="button" class="preview-retry" aria-label="Tentar carregar a miniatura novamente"
      title="Tentar carregar a miniatura novamente" onclick={() => {
        previews = { ...previews, [path]: undefined };
        requests.preview(path, true);
      }}><RefreshCw size={17} aria-hidden="true" /></button>
  {:else if path}
    <span class="preview-loading" aria-hidden="true"><Skeleton height="100%" /></span>
  {:else}
    <Image size={20} aria-hidden="true" />
  {/if}
{/snippet}

{#if preparing}
  <HomepageHighlightsSkeleton
    label="A carregar as fotografias dos destaques…"
    selected={editor.items.length}
    candidates={editor.candidates.length}
  />
{:else if initialPaths.some((path) => previews[path] === null)}
  <Panel><p class="initial-status" role="status">Algumas miniaturas não ficaram disponíveis. Pode voltar a tentar junto de cada fotografia.</p></Panel>
{/if}

<div class="editor-grid" class:preparing bind:this={editorGrid}>
  <Panel>
    <PanelHeader icon={Star} title="Carrossel da homepage" meta={`${items.length} / 5`} />
    <div class="intro">
      Organize os destaques e enquadre a fotografia principal de cada viatura.
      {#if contextMessage}<p class="context-message" role="status">{contextMessage}</p>{/if}
    </div>
    {#if items.length === 0}
      <div class="empty">
        <Image size={28} />
        <p>A primeira impressão começa aqui.</p>
        <span>Adicione uma viatura publicada para criar o primeiro destaque.</span>
      </div>
    {/if}
    <ol class="selected-list">
      {#each items as item, index (item.vehicleId)}
        {@const vehicle = editor.candidates.find((candidate) => candidate.id === item.vehicleId)}
        {@const gallery = galleries[item.vehicleId]}
        {@const selectedPhoto = gallery?.status === 'ready' ? gallery.photos[0] : undefined}
        {@const selectedPath = gallery?.status === 'ready'
          ? selectedPhoto?.path
          : vehicle?.photoPaths.includes(item.photoPath) ? item.photoPath : undefined}
        {@const focus = featuredFramingPosition(item.framing, 'desktop')}
        <li data-highlight-vehicle={item.vehicleId} animate:flip={{ ...reorderMotion(), duration: reordering ? reorderMotion().duration : 0 }}>
          <div class="selected-row">
            <span class="position">{String(index + 1).padStart(2, '0')}</span>
            <div class="photo-controls">
            <div class="cover unavailable" style:aspect-ratio={featuredFramingRatio.desktop} use:observePreview={selectedPath}>
              {@render preview(selectedPath, vehicle ? `${vehicle.brand} ${vehicle.model} — fotografia principal` : '', item.framing)}
            </div>

              {#if vehicle}<button type="button" class="frame-photo" disabled={saving || !selectedPath}
                aria-expanded={choosing === item.vehicleId}
                onclick={() => toggleFraming(item.vehicleId)}>Enquadrar</button>{/if}
            </div>
            <div class="vehicle-info">
              <strong
                >{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Viatura indisponível'}</strong
              >
              <span>{vehicle?.year ?? 'Retirada do site ou vendida'}</span>
              {#if !selectedPath}<span class="warning"
                  >Sem fotografia principal disponível. Atualize a viatura ou remova este destaque.</span
                >{/if}
</div>
            <SelectionOrderActions {index} count={items.length} kind="destaque" disabled={saving} onmove={(direction) => move(index, direction)} onremove={() => remove(index)} />
          </div>
          {#if choosing === item.vehicleId && vehicle}
            {#if gallery?.status === 'error' || (gallery?.status === 'ready' && !selectedPhoto?.url)}
              <div class="gallery-status" role="status">
                <span>Não foi possível carregar as fotografias desta viatura.</span>
                <Button type="button" variant="outline" onclick={() => void requests.gallery(vehicle.id, true)}>Tentar novamente</Button>
              </div>
            {:else}
              <div class="framing-panel" transition:slide|global={reorderMotion()}
                onintroend={(event) => { if (choosing === item.vehicleId) void revealFraming(event.currentTarget); }}>
                <PhotoFramingEditor photo={selectedPhoto} src={selectedPhoto?.url ?? previews[item.photoPath]?.url ?? ''}
                  value={item.framing} context="featured" loading={gallery?.status !== 'ready'} disabled={saving || gallery?.status !== 'ready'}
                  onchange={framing => items = items.map(entry => entry.vehicleId === item.vehicleId ? {...entry, framing} : entry)}>
                  {#snippet actions()}
                    <PhotoFramingActions label={saving ? 'A guardar…' : 'Guardar enquadramento'}
                      note="Guarda o enquadramento e as alterações aos destaques da homepage."
                      disabled={saving || !dirty || gallery?.status !== 'ready'} onsave={() => selectionForm.requestSubmit()} />
                  {/snippet}
                </PhotoFramingEditor>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ol>
    <form
      bind:this={selectionForm}
      method="POST"
      use:formFeedback
      use:enhance={({ formElement }) => {
        const submitted = $state.snapshot(items);
        const summary = saveSummary(submitted);
        saving = true;
        message = '';
        return async ({ result, update }) => {
          try {
            if (result.type === 'success') {
              const savedRevision = result.data?.revision;
              if (typeof savedRevision !== 'string') {
                message = 'Não foi possível confirmar a gravação. Recarregue antes de tentar novamente.';
                toast.error(message);
                return;
              }
              // The save response contains the new revision. Keep the streamed
              // editor mounted instead of reloading its full photo catalogue.
              await update({ reset: false, invalidateAll: false });
              savedItems = submitted;
              revision = savedRevision;
              await tick();
              markFormSaved(formElement);
              choosing = null;
              if (selectedVehicleId) contextMessage = savedItems.some(item => item.vehicleId === selectedVehicleId)
                ? 'Seleção de destaques guardada. O enquadramento da fotografia principal foi confirmado.'
                : 'A viatura foi retirada da seleção guardada.';
              siteSavedFeedback(summary);
            } else if (result.type === 'failure') {
              message = (result.data as { error?: string })?.error ?? 'Não foi possível guardar.';
              toast.error(message);
            } else {
              await update({ reset: false });
            }
          } finally {
            saving = false;
          }
        };
      }}
    >
      <input
        type="hidden"
        name="selection"
        value={JSON.stringify({ revision, items })}
      />
      {#if message}<p class="save-error" role="alert">{message}</p>{/if}
      <div class="save-bar">
        <span>{dirty ? 'Alterações por guardar' : 'A seleção guardada é usada no site.'}</span
        ><Button type="submit" disabled={saving || !dirty} loading={saving}
          >{saving ? 'A guardar…' : 'Guardar destaques'}</Button
        >
      </div>
    </form>
  </Panel>

  <VehicleCatalogue
    vehicles={filtered}
    selected={new Set(items.map(({ vehicleId }) => vehicleId))}
    canAdd={!saving && items.length < 5}
    onAdd={(vehicle) => add(vehicle.id, vehicle.photoPaths[0]!)}
    bind:query
    searchLabel="Pesquisar viaturas publicadas"
    placeholder="Marca, modelo ou ano"
    empty={query ? 'Nenhuma viatura encontrada.' : 'Ainda não há viaturas publicadas com fotografias. Publique uma viatura para a adicionar aqui.'}
  >
    {#snippet thumbnail(vehicle)}
      <div class="candidate-placeholder" style={framingStyle(vehicle.coverFraming)} use:observePreview={vehicle.photoPaths[0]}>
        {@render preview(vehicle.photoPaths[0], '', vehicle.coverFraming, 50)}
      </div>
    {/snippet}
    {#snippet detail(vehicle)}{vehicle.year} · {vehicle.photoPaths.length} fotografias{/snippet}
  </VehicleCatalogue>
</div>

<style>
  .editor-grid.preparing {
    display: none;
  }
  .initial-status {
    padding: 18px 20px;
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .context-message {
    margin-top: 10px;
    color: var(--color-text);
    font-size: 14px;
    line-height: 1.6;
  }
  .editor-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr);
    gap: 24px;
    align-items: start;
  }
  .intro,
  .hint {
    font-size: 12px;
    line-height: 1.65;
    color: var(--color-text-muted);
  }
  .intro {
    padding: 18px 20px;
    border-bottom: 1px solid var(--color-border);
  }
  .empty {
    display: grid;
    justify-items: center;
    text-align: center;
    padding: 46px 24px;
    gap: 12px;
    color: var(--color-text-faint);
  }
  .empty p {
    color: var(--color-text);
    font-size: 15px;
  }
  .empty span {
    font-size: 12px;
    max-width: 300px;
  }
  .selected-list {
    overflow-anchor: none;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .selected-list li {
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-0);
  }
  .selected-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
  }
  .position {
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    color: var(--color-red);
  }
  .photo-controls { width: 128px; flex-shrink: 0; }
  .frame-photo { display: block; width: 100%; min-height: 36px; margin-top: 6px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-btn); background: var(--color-bg-1); color: var(--color-text); font-size: 12px; line-height: 1.4; }
  .framing-panel { margin: 0 20px 20px; min-width: 0; }
  .cover {
    position: relative;
    width: 128px;
    overflow: hidden;
    flex-shrink: 0;
    border-radius: var(--radius-card);
    background: var(--color-bg-2);
  }
  .unavailable {
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
  }
  .cover img, .candidate-placeholder img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover img {
    position: absolute;
    inset: 0;
  }
  .preview-loading {
    position: absolute;
    inset: 0;
    display: flex;
  }
  .preview-retry {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }
  .gallery-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 12px 20px;
    color: var(--color-text-muted);
    font-size: 13px;
  }
  .vehicle-info {
    display: grid;
    gap: 5px;
    flex: 1;
    min-width: 0;
  }
  strong {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }
  .vehicle-info > span {
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .vehicle-info .warning {
    color: var(--color-red);
    line-height: 1.5;
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  button:not(:disabled):hover {
    color: var(--color-text);
    border-color: var(--color-border-strong);
  }
  .save-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px;
    padding: 18px 20px;
  }
  .save-bar > span {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    color: var(--color-text-faint);
  }
  .save-error {
    color: var(--color-red);
    font-size: 12px;
    padding: 16px 20px 0;
  }
  .candidate-placeholder {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: var(--radius-btn);
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
  }
  .candidate-placeholder img {
    position: absolute;
    inset: 0;
    object-position: var(--photo-desktop, 50% 50%);
  }
  @media (max-width: 700px) {
    .candidate-placeholder img { object-position: var(--photo-mobile, 50% 50%); }
  }
  @media (max-width: 1100px) {
    .editor-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .selected-row {
      flex-wrap: wrap;
      gap: 10px;
      padding: 16px;
    }
    .photo-controls, .cover {
      width: 92px;
    }
    .framing-panel { margin: 0 16px 16px; }
  }
</style>
