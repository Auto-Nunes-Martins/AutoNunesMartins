<script lang="ts">
  import { reusablePhoto, selectPhoto } from '$lib/reusablePhoto';
  import { framingStyle } from '@anm/types';
  import { photoAttrs, photoFallback } from '$lib/vehicleImage';
  import PhotoFramingEditor from './PhotoFramingEditor.svelte';
  import VehicleCatalogue from './VehicleCatalogue.svelte';
  import { crmPath } from '$lib/paths';
  import { untrack, onMount } from 'svelte';
  import { enhance } from '$lib/auth/enhance';
  import { sessionFetch } from '$lib/auth/session';
  import { tick } from 'svelte';
  import { formFeedback, markFormSaved, refreshFormFeedback } from '$lib/forms/formFeedback';
  import { prepareVehicleHighlight } from '$lib/highlightSelection';
  import { toast } from 'svelte-sonner';
  import { ArrowUp, ArrowDown, Check, Star, Image, RefreshCw, Trash2 } from 'lucide-svelte';
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
  let items = $state<HighlightItem[]>(untrack(() => editor.items.map((item) => ({ ...item }))));
  let savedItems = $state<HighlightItem[]>(untrack(() => editor.items));
  let revision = $state(untrack(() => editor.revision));
  let query = $state('');
  let saving = $state(false);
  let message = $state('');
  let choosing = $state<string | null>(null);
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
      ...editor.items.flatMap((item) => editor.candidates.some((vehicle) =>
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
    items = editor.items.map((item) => ({ ...item }));
    savedItems = editor.items;
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
        row?.querySelector<HTMLButtonElement>('button.text-action')?.focus({ preventScroll: true });
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
    items = [...items, { vehicleId, photoPath }];
    choosing = vehicleId;
  }
  function move(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    items = next;
  }
</script>

{#snippet preview(path: string | undefined, alt: string, position?: string)}
  {@const thumbnail = path ? previews[path] : undefined}
  {#if thumbnail?.url}
    <img src={thumbnail.url} use:photoFallback={preparing ? null : thumbnail.originalUrl} {alt}
      data-highlight-preview={path}
      style:object-position={position} decoding="async"
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
      Escolha a fotografia de cada viatura e a ordem em que aparece no header do site.
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
        {@const selectedPhoto = gallery?.status === 'ready' ? gallery.photos.find((photo) => photo.path === item.photoPath) : undefined}
        {@const selectedPath = gallery?.status === 'ready'
          ? selectedPhoto?.path
          : vehicle?.photoPaths.includes(item.photoPath) ? item.photoPath : undefined}
        {@const focus = featuredFramingPosition(item.framing, 'desktop')}
        <li data-highlight-vehicle={item.vehicleId}>
          <div class="selected-row">
            <span class="position">{String(index + 1).padStart(2, '0')}</span>
            <div class="cover unavailable" style:aspect-ratio={featuredFramingRatio.desktop} use:observePreview={selectedPath}>
              {@render preview(selectedPath, vehicle ? `${vehicle.brand} ${vehicle.model} — fotografia escolhida` : '', `${focus.x}% ${focus.y}%`)}
            </div>
            <div class="vehicle-info">
              <strong
                >{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Viatura indisponível'}</strong
              >
              <span>{vehicle?.year ?? 'Retirada do site ou vendida'}</span>
              {#if !selectedPath}<span class="warning"
                  >Não aparece no site. Escolha outra fotografia ou remova este destaque.</span
                >{/if}
              {#if vehicle}<button
                  type="button"
                  class="text-action photo-action"
                  disabled={saving}
                  onclick={() => (choosing = choosing === item.vehicleId ? null : item.vehicleId)}
                  >{choosing === item.vehicleId
                    ? 'Fechar fotografias'
                    : 'Escolher fotografia'}</button
                >{/if}
            </div>
            <div class="row-actions">
              <button
                type="button"
                aria-label={`Subir destaque ${index + 1}`}
                title="Subir"
                disabled={saving || index === 0}
                onclick={() => move(index, -1)}><ArrowUp size={16} /></button
              >
              <button
                type="button"
                aria-label={`Descer destaque ${index + 1}`}
                title="Descer"
                disabled={saving || index === items.length - 1}
                onclick={() => move(index, 1)}><ArrowDown size={16} /></button
              >
              <button
                type="button"
                aria-label={`Remover destaque ${index + 1}`}
                title="Remover do carrossel"
                disabled={saving}
                onclick={() => (items = items.filter((_, i) => i !== index))}
                ><Trash2 size={16} /></button
              >
            </div>
          </div>
          {#if choosing === item.vehicleId && vehicle}
            {#if gallery?.status === 'error'}
              <div class="gallery-status" role="status">
                <span>Não foi possível carregar as fotografias desta viatura.</span>
                <Button type="button" variant="outline" onclick={() => void requests.gallery(vehicle.id, true)}>Tentar novamente</Button>
              </div>
            {:else if gallery?.status === 'ready'}
            <div
              class="photo-picker"
              role="group"
              aria-label={`Fotografias de ${vehicle.brand} ${vehicle.model}`}
            >
              {#each gallery.photos as photo, photoIndex (photo.path)}
                <button
                  type="button"
                  class:chosen={photo.path === item.photoPath}
                  disabled={saving || !photo.url}
                  aria-label={`Fotografia ${photoIndex + 1}`}
                  aria-pressed={photo.path === item.photoPath}
                  onclick={() =>
                    (items = items.map((entry) =>
                      entry.vehicleId === item.vehicleId
                        ? { ...entry, photoPath: photo.path, framing: undefined }
                        : entry,
                    ))}
                >
                  {#if photo.url}<img {...photoAttrs(photo,320,'128px')} use:reusablePhoto={{photo}} alt="" loading="eager" />{:else}<Image
                      size={20}
                    />{/if}
                  {#if photo.path === item.photoPath}<span class="photo-check"
                      ><Check size={14} /></span
                    >{/if}
                </button>
              {/each}
            </div>
            {#if gallery.photos.some((photo) => !photo.url)}
              <div class="gallery-status" role="status"><span>Algumas fotografias não estão disponíveis.</span>
                <Button type="button" variant="outline" onclick={() => void requests.gallery(vehicle.id, true)}>Tentar novamente</Button>
              </div>
            {/if}
            {#if selectedPhoto?.url}
              <PhotoFramingEditor photo={selectedPhoto} src={selectedPhoto.url} value={item.framing} context="featured" disabled={saving} onchange={framing => items = items.map(entry => entry.vehicleId === item.vehicleId ? {...entry, framing} : entry)} />
            {/if}
            {:else}
              <p class="sr-only" role="status">A carregar fotografias…</p>
              <div class="photo-picker" aria-hidden="true">
                {#each vehicle.photoPaths as path (path)}
                  <div class="photo-picker-placeholder"><Skeleton height="100%" /></div>
                {/each}
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
        saving = true;
        message = '';
        return async ({ result, update }) => {
          try {
            if (result.type === 'success') {
              const savedRevision = result.data?.revision;
              if (typeof savedRevision !== 'string') {
                message = 'Não foi possível confirmar a gravação. Recarregue antes de tentar novamente.';
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
                ? 'Seleção de destaques guardada. A fotografia escolhida foi confirmada.'
                : 'A viatura foi retirada da seleção guardada.';
              toast.success('Destaques da homepage guardados.');
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
    {#snippet intro()}
      <p class="hint catalogue-hint">
        Apenas viaturas publicadas com fotografias. Ao serem vendidas ou retiradas do site,
        deixam de aparecer no carrossel.
      </p>
    {/snippet}
    {#snippet thumbnail(vehicle)}
      <div class="candidate-placeholder" style={framingStyle(vehicle.coverFraming)} use:observePreview={vehicle.photoPaths[0]}>
        {@render preview(vehicle.photoPaths[0], '')}
      </div>
    {/snippet}
    {#snippet detail(vehicle)}{vehicle.year} · {vehicle.photoPaths.length} fotografias{/snippet}
    {#snippet footer()}<a class="text-action" href={crmPath("/viaturas")}>Consultar viaturas →</a>{/snippet}
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
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .selected-list li {
    border-bottom: 1px solid var(--color-border);
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
  .text-action {
    color: var(--color-text-muted);
    font-size: 11px;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .text-action:hover {
    color: var(--color-text);
  }
  @media (hover: hover) {
    .photo-action:not(:disabled):hover {
      color: white;
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    :global([data-theme='light']) .photo-action:not(:disabled):hover {
      color: var(--color-text);
    }
  }
  .row-actions {
    display: flex;
    gap: 2px;
  }
  .row-actions button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 34px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
  }
  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  button:not(:disabled):hover {
    color: var(--color-text);
    border-color: var(--color-border-strong);
  }
  .photo-picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 8px;
    padding: 0 20px 20px;
  }
  .photo-picker button {
    position: relative;
    aspect-ratio: 16/10;
    overflow: hidden;
    border: 2px solid transparent;
    border-radius: var(--radius-btn);
  }
  .photo-picker-placeholder {
    display: flex;
    aspect-ratio: 16 / 10;
  }
  .photo-picker .chosen {
    border-color: var(--color-red);
  }
  .photo-picker img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-check {
    position: absolute;
    right: 3px;
    bottom: 3px;
    background: var(--color-red);
    color: white;
    padding: 3px;
    border-radius: 2px;
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
  .catalogue-hint { margin: 0; }
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
  .candidate-placeholder img { object-position: var(--photo-desktop, 50% 50%); }
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
    .cover {
      width: 92px;
    }
    .row-actions {
      margin-left: auto;
    }
    .photo-picker {
      padding: 0 16px 16px;
    }
  }
</style>
