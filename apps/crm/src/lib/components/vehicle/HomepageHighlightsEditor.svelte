<script lang="ts">
  import {photoAttrs,photoFallback} from '$lib/vehicleImage';
  import { crmPath } from '$lib/paths';
  import { untrack, onMount } from 'svelte';
  import { enhance } from '$lib/auth/enhance';
  import { tick } from 'svelte';
  import { formFeedback, markFormSaved, refreshFormFeedback } from '$lib/forms/formFeedback';
  import { prepareVehicleHighlight } from '$lib/highlightSelection';
  import { toast } from 'svelte-sonner';
  import { ArrowUp, ArrowDown, Check, Image, Plus, Search, Trash2 } from 'lucide-svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import type { HighlightsEditor, HighlightItem } from '$lib/homepageHighlights';

  let { editor, selectedVehicleId = null }: { editor: HighlightsEditor; selectedVehicleId?: string | null } = $props();
  let items = $state<HighlightItem[]>(untrack(() => editor.items.map((item) => ({ ...item }))));
  let query = $state('');
  let saving = $state(false);
  let message = $state('');
  let choosing = $state<string | null>(null);
  let mounted = $state(false);
  let appliedContext = '';
  let contextMessage = $state('');
  let selectionForm: HTMLFormElement;
  onMount(() => { mounted = true; });
  $effect(() => {
    items = editor.items.map((item) => ({ ...item }));
  });
  $effect(() => {
    const id = selectedVehicleId;
    if (!mounted || !id || id === appliedContext) return;
    untrack(() => {
      appliedContext = id;
      const prepared = prepareVehicleHighlight(editor, id);
      items = prepared.items;
      choosing = prepared.choosing;
      contextMessage = prepared.message;
      const vehicle = editor.candidates.find(candidate => candidate.id === id);
      if (!prepared.choosing && vehicle) query = `${vehicle.brand} ${vehicle.model}`;
      void tick().then(() => {
        if (selectionForm) refreshFormFeedback(selectionForm);
        const row = selectionForm?.parentElement?.querySelector<HTMLElement>(`[data-highlight-vehicle="${CSS.escape(id)}"]`);
        row?.scrollIntoView({ block: 'center' });
        row?.querySelector<HTMLButtonElement>('.photo-picker button[aria-pressed="true"]')?.focus({ preventScroll: true });
      });
    });
  });
  const dirty = $derived(JSON.stringify(items) !== JSON.stringify(editor.items));
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

<div class="editor-grid">
  <Panel>
    <PanelHeader icon={Image} title="Carrossel da homepage" meta={`${items.length} / 5`} />
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
        {@const selectedPhoto = vehicle?.photos.find((photo) => photo.path === item.photoPath)}
        <li data-highlight-vehicle={item.vehicleId}>
          <div class="selected-row">
            <span class="position">{String(index + 1).padStart(2, '0')}</span>
            {#if selectedPhoto?.url}<img
                class="cover"
                {...photoAttrs(selectedPhoto,320,'128px')} use:photoFallback={selectedPhoto.url}
                alt={`${vehicle?.brand} ${vehicle?.model} — fotografia escolhida`}
              />{:else}<div class="cover unavailable"><Image size={20} /></div>{/if}
            <div class="vehicle-info">
              <strong
                >{vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Viatura indisponível'}</strong
              >
              <span>{vehicle?.year ?? 'Retirada do site ou vendida'}</span>
              {#if !selectedPhoto}<span class="warning"
                  >Não aparece no site. Escolha outra fotografia ou remova este destaque.</span
                >{/if}
              {#if vehicle}<button
                  type="button"
                  class="text-action"
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
            <div
              class="photo-picker"
              role="group"
              aria-label={`Fotografias de ${vehicle.brand} ${vehicle.model}`}
            >
              {#each vehicle.photos as photo, photoIndex (photo.path)}
                <button
                  type="button"
                  class:chosen={photo.path === item.photoPath}
                  disabled={saving || !photo.url}
                  aria-label={`Fotografia ${photoIndex + 1}`}
                  aria-pressed={photo.path === item.photoPath}
                  onclick={() =>
                    (items = items.map((entry) =>
                      entry.vehicleId === item.vehicleId
                        ? { ...entry, photoPath: photo.path }
                        : entry,
                    ))}
                >
                  {#if photo.url}<img {...photoAttrs(photo,320,'128px')} use:photoFallback={photo.url} alt="" loading="lazy" />{:else}<Image
                      size={20}
                    />{/if}
                  {#if photo.path === item.photoPath}<span class="photo-check"
                      ><Check size={14} /></span
                    >{/if}
                </button>
              {/each}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <form
      bind:this={selectionForm}
      method="POST"
      use:formFeedback
      use:enhance={({ formElement }) => {
        saving = true;
        message = '';
        return async ({ result, update }) => {
          try {
            if (result.type === 'success') {
              await update({ reset: false });
              await tick();
              markFormSaved(formElement);
              if (selectedVehicleId) contextMessage = editor.items.some(item => item.vehicleId === selectedVehicleId)
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
        value={JSON.stringify({ revision: editor.revision, items })}
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

  <Panel>
    <PanelHeader icon={Plus} title="Adicionar viaturas" />
    <div class="catalogue">
      <label class="search"
        ><Search size={16} /><input
          type="search"
          aria-label="Pesquisar viaturas publicadas"
          placeholder="Marca, modelo ou ano"
          bind:value={query}
        /></label
      >
      <p class="hint">
        Apenas viaturas publicadas com fotografias. Ao serem vendidas ou retiradas do
        site, deixam de aparecer no carrossel.
      </p>
      <div class="candidates">
        {#each filtered as vehicle (vehicle.id)}
          {@const selected = items.some((item) => item.vehicleId === vehicle.id)}
          <div class="candidate">
            {#if vehicle.photos[0]?.url}<img
                {...photoAttrs(vehicle.photos[0],320,'64px')} use:photoFallback={vehicle.photos[0].url}
                alt=""
                loading="lazy"
              />{:else}<div class="candidate-placeholder"><Image size={18} /></div>{/if}
            <div>
              <strong>{vehicle.brand} {vehicle.model}</strong><span
                >{vehicle.year} · {vehicle.photos.length} fotografias</span
              >
            </div>
            <button
              type="button"
              class="add-button"
              disabled={saving || selected || items.length >= 5}
              aria-label={selected
                ? `${vehicle.brand} ${vehicle.model} já selecionado`
                : `Adicionar ${vehicle.brand} ${vehicle.model}`}
              onclick={() => add(vehicle.id, vehicle.photos[0]!.path)}
              >{#if selected}<Check size={17} />{:else}<Plus size={17} />{/if}</button
            >
          </div>
        {:else}
          <p class="hint">
            {query
              ? 'Nenhuma viatura encontrada.'
              : 'Ainda não há viaturas publicadas com fotografias. Publique uma viatura para a adicionar aqui.'}
          </p>
        {/each}
      </div>
      <a class="text-action" href={crmPath("/viaturas")}>Consultar viaturas →</a>
    </div>
  </Panel>
</div>

<style>
  .context-message {margin-top:10px;color:var(--color-text);font-size:14px;line-height:1.6;}
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
    width: 128px;
    aspect-ratio: 16/10;
    object-fit: cover;
    flex-shrink: 0;
    border-radius: var(--radius-card);
    background: var(--color-bg-2);
  }
  .unavailable {
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
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
  .vehicle-info > span,
  .candidate span {
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
  .row-actions {
    display: flex;
    gap: 2px;
  }
  .row-actions button,
  .add-button {
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
  .catalogue {
    padding: 20px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    padding: 10px 12px;
    color: var(--color-text-faint);
  }
  .search input {
    width: 100%;
    background: transparent;
    outline: none;
    font-size: 12px;
    color: var(--color-text);
  }
  .hint {
    margin: 14px 0;
  }
  .candidates {
    display: grid;
    gap: 2px;
    margin-bottom: 18px;
  }
  .candidate {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border);
  }
  .candidate img,
  .candidate-placeholder {
    width: 64px;
    height: 48px;
    object-fit: cover;
    border-radius: var(--radius-btn);
  }
  .candidate-placeholder {
    display: grid;
    place-items: center;
    color: var(--color-text-faint);
  }
  .candidate > div:not(.candidate-placeholder) {
    display: grid;
    gap: 5px;
    flex: 1;
  }
  .add-button {
    flex-shrink: 0;
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
