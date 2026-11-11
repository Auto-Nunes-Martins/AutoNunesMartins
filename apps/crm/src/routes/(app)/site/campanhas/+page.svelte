<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Check, Plus, Search, Tag, Trash2 } from 'lucide-svelte';
  import CampaignVehiclePhoto from '$lib/components/vehicle/CampaignVehiclePhoto.svelte';
  import { formatEUR, formatLisbonDateTime } from '$lib/utils/format';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  type Editor = NonNullable<PageData['editor']>;
  type Item = Editor['items'][number];
  type Vehicle = Editor['candidates'][number];
  type Draft = {
    id: string;
    price: string;
    discount: string;
    days: number | undefined;
    saved?: Item;
    edited: boolean;
    error?: string;
  };

  let drafts = $state<Draft[]>(untrack(() => initialDrafts(data.editor)));
  let revision = untrack(() => data.editor?.revision);
  let query = $state('');
  let busy = $state(false);
  let feedback = $state('');
  let validation = $state('');
  const vehicles = $derived(data.editor?.candidates ?? []);
  const vehicleById = $derived(new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])));
  const selected = $derived(new Set(drafts.map((draft) => draft.id)));
  const available = $derived(
    vehicles.filter((vehicle) =>
      searchText(`${vehicle.brand} ${vehicle.model} ${vehicle.licensePlate ?? ''}`).includes(
        searchText(query),
      ),
    ),
  );
  const changed = $derived(
    drafts.length !== data.editor?.items.length ||
      drafts.some(
        (draft) =>
          draft.edited ||
          !draft.saved ||
          (draft.saved.referencePrice === null && !!vehicleById.get(draft.id)?.referencePrice),
      ),
  );

  $effect(() => {
    if (data.editor && data.editor.revision !== revision) {
      revision = data.editor.revision;
      drafts = initialDrafts(data.editor);
    }
  });

  function searchText(value: string) {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLocaleLowerCase('pt-PT');
  }

  function initialDrafts(editor: PageData['editor']): Draft[] {
    return (editor?.items ?? []).map((item) => {
      const vehicle = editor?.candidates.find(({ id }) => id === item.vehicleId);
      const reference = Number(item.referencePrice ?? vehicle?.referencePrice ?? vehicle?.price);
      return {
        id: item.vehicleId,
        price: item.price,
        discount: roundedDiscount(Number(item.price), reference),
        days: item.durationDays,
        saved: item,
        edited: false,
      };
    });
  }

  function cents(value: string) {
    const cleaned = value.trim().replace(',', '.');
    return /^\d{1,10}(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : NaN;
  }

  function roundedDiscount(amount: number, reference: number) {
    return amount > 0 && amount <= reference
      ? String(Math.round((1 - amount / reference) * 100))
      : '';
  }

  function referenceFor(draft: Draft, vehicle: Vehicle | undefined, amount: number) {
    const saved = draft.saved;
    if (saved?.referencePrice && amount === cents(saved.price)) return Number(saved.referencePrice);
    return Number(vehicle?.referencePrice ?? vehicle?.price);
  }

  function edit(draft: Draft) {
    draft.edited = true;
    draft.error = '';
    feedback = '';
    validation = '';
  }

  function updatePrice(draft: Draft, value: string) {
    draft.price = value;
    const amount = cents(value);
    draft.discount = roundedDiscount(
      amount / 100,
      referenceFor(draft, vehicleById.get(draft.id), amount),
    );
    edit(draft);
  }

  function updateDiscount(draft: Draft, vehicle: Vehicle, value: string) {
    draft.discount = value;
    const reference = Number(vehicle.referencePrice ?? vehicle.price);
    const percentage = Number(value);
    draft.price =
      /^\d{1,2}$/.test(value) && percentage >= 1 && reference > 0
        ? (Math.round(reference * (100 - percentage)) / 100).toFixed(2)
        : '';
    edit(draft);
  }

  function transitionOptions() {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { y: reduced ? 0 : 16, duration: reduced ? 0 : 230 };
  }

  async function focusAt(id: string) {
    await tick();
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function add(vehicle: Vehicle) {
    if (drafts.length >= 4 || selected.has(vehicle.id) || busy) return;
    drafts = [...drafts, { id: vehicle.id, price: '', discount: '', days: 7, edited: true }];
    feedback = `${vehicle.brand} ${vehicle.model} adicionada à seleção.`;
    validation = '';
    void focusAt(`campaign-${vehicle.id}`);
  }

  function remove(draft: Draft) {
    const index = drafts.findIndex(({ id }) => id === draft.id);
    drafts = drafts.filter(({ id }) => id !== draft.id);
    feedback = 'Viatura retirada da seleção.';
    validation = '';
    const nearby = drafts[Math.min(index, drafts.length - 1)];
    void focusAt(nearby ? `campaign-${nearby.id}` : 'campaign-selected-title');
  }

  function prepareItems() {
    const items = [];
    let firstInvalid: string | undefined;
    for (const draft of drafts) {
      const vehicle = vehicleById.get(draft.id);
      const amount = cents(draft.price);
      const limit = Math.min(
        cents(vehicle?.price ?? ''),
        Math.round(referenceFor(draft, vehicle, amount) * 100),
      );
      if (!vehicle) {
        draft.error = 'Retire esta viatura para guardar as campanhas.';
      } else if (!(amount > 0 && amount < limit)) {
        draft.error = 'Indique um preço positivo inferior ao preço de referência.';
      } else if (
        !draft.days ||
        !Number.isInteger(draft.days) ||
        draft.days < 1 ||
        draft.days > 365
      ) {
        draft.error = 'Indique uma duração de 1 a 365 dias.';
      } else {
        draft.error = '';
        items.push({
          vehicleId: draft.id,
          price: (amount / 100).toFixed(2),
          durationDays: draft.days,
          recheck:
            draft.edited || (draft.saved?.referencePrice === null && !!vehicle.referencePrice),
        });
      }
      if (draft.error) firstInvalid ??= `campaign-${draft.id}`;
    }
    if (firstInvalid) {
      void focusAt(firstInvalid);
      return;
    }
    return items;
  }
</script>

<svelte:head><title>Campanhas · Site público · Auto Nunes Martins</title></svelte:head>

<section class="campaign-editor" aria-labelledby="campaign-heading">
  <div class="heading">
    <div>
      <h2 id="campaign-heading">Campanhas</h2>
      <p>Escolha até quatro viaturas e edite as ofertas diretamente nos cartões.</p>
    </div>
    {#if data.editor}
      <a
        class="mobile-link"
        href="#campaign-catalog-title"
        onclick={(event) => {
          event.preventDefault();
          void focusAt('campaign-catalog-title');
        }}>Ver catálogo</a
      >
    {/if}
  </div>

  {#if !data.editor}
    <p role="alert">
      Não foi possível carregar as campanhas. Atualize a página para tentar novamente.
    </p>
  {:else}
    <div class="layout">
      <section class="campaigns" aria-labelledby="campaign-selected-title">
        <div class="panel-heading">
          <h3 id="campaign-selected-title" tabindex="-1">Viaturas em campanha</h3>
          <span class="count">{drafts.length} / 4</span>
        </div>
        <form
          method="POST"
          novalidate
          use:enhance={({ formData, cancel }) => {
            const items = prepareItems();
            if (busy || !items) return cancel();
            formData.set('campaigns', JSON.stringify({ revision: data.editor?.revision, items }));
            busy = true;
            validation = '';
            return async ({ result, update }) => {
              try {
                await update({ reset: false });
                if (result.type === 'success') feedback = 'Campanhas guardadas.';
                if (result.type === 'failure')
                  validation = String(result.data?.error ?? 'Não foi possível guardar.');
              } finally {
                busy = false;
              }
            };
          }}
        >
          <div class="cards">
            {#each drafts as draft (draft.id)}
              {@const vehicle = vehicleById.get(draft.id)}
              {@const price = cents(draft.price)}
              <article class="campaign-card" transition:fly={transitionOptions()}>
                {#if vehicle}
                  <div class="card-photo"><CampaignVehiclePhoto vehicleId={vehicle.id} /></div>
                {/if}
                <div class="card-content">
                  <div class="card-heading">
                    <div>
                      <span
                        class="state"
                        class:active={!!draft.saved?.referencePrice && !draft.edited}
                      >
                        {draft.edited
                          ? 'Por guardar'
                          : draft.saved?.referencePrice
                            ? 'Em campanha'
                            : 'Em preparação'}
                      </span>
                      <h4
                        id={`campaign-${draft.id}`}
                        tabindex="-1"
                        aria-describedby={draft.error ? `error-${draft.id}` : undefined}
                      >
                        {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Viatura indisponível'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      class="remove"
                      aria-label={vehicle
                        ? `Remover ${vehicle.brand} ${vehicle.model}`
                        : 'Remover viatura indisponível'}
                      disabled={busy}
                      onclick={() => remove(draft)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  {#if vehicle}
                    <div class="price-preview">
                      <strong>{price > 0 ? formatEUR(price / 100) : 'Definir preço'}</strong>
                      {#if draft.saved?.referencePrice && price === cents(draft.saved.price)}
                        <s aria-label={`Preço anterior ${formatEUR(draft.saved.referencePrice)}`}
                          >{formatEUR(draft.saved.referencePrice)}</s
                        >
                      {/if}
                    </div>
                    <p class="context">Preço público normal · {formatEUR(vehicle.price)}</p>
                    <fieldset disabled={busy} class="fields">
                      <legend class="sr-only"
                        >Editar campanha de {vehicle.brand} {vehicle.model}</legend
                      >
                      <label
                        >Preço promocional (€)
                        <input
                          value={draft.price}
                          oninput={(event) => updatePrice(draft, event.currentTarget.value)}
                          inputmode="decimal"
                          required
                        />
                      </label>
                      <label
                        >Desconto (%)
                        <input
                          value={draft.discount}
                          oninput={(event) =>
                            updateDiscount(draft, vehicle, event.currentTarget.value)}
                          inputmode="numeric"
                          maxlength="2"
                        />
                      </label>
                      <label
                        >Duração (dias)
                        <input
                          type="number"
                          min="1"
                          max="365"
                          bind:value={draft.days}
                          oninput={() => edit(draft)}
                          required
                        />
                      </label>
                    </fieldset>
                    {#if draft.saved?.referencePrice && !draft.edited}
                      <p class="context">
                        De {formatLisbonDateTime(draft.saved.startsAt)} a {formatLisbonDateTime(
                          draft.saved.endsAt,
                        )} (Lisboa).
                      </p>
                    {:else if !vehicle.referencePrice && !draft.saved?.referencePrice}
                      <p class="context">
                        Fica em preparação até haver 30 dias de histórico de preços e voltar a
                        guardar.
                      </p>
                    {/if}
                  {/if}
                  {#if draft.error}<p class="error" role="alert" id={`error-${draft.id}`}>
                      {draft.error}
                    </p>{/if}
                </div>
              </article>
            {:else}
              <div class="empty">
                <Tag size={25} strokeWidth={1.5} aria-hidden="true" />
                <p>Nenhuma campanha selecionada.</p>
              </div>
            {/each}
          </div>
          <div class="actions">
            <button class="primary" type="submit" disabled={busy || !changed}
              >{busy ? 'A guardar…' : 'Guardar campanhas'}</button
            >
            {#if validation}<p role="alert" class="error">{validation}</p>{/if}
            <p class="feedback" role="status">
              {feedback || (form?.saved && !changed ? 'Campanhas guardadas.' : '')}
            </p>
          </div>
        </form>
      </section>

      <section class="catalog" aria-labelledby="campaign-catalog-title">
        <div class="panel-heading">
          <h3 id="campaign-catalog-title" tabindex="-1">Catálogo de viaturas</h3>
        </div>
        <label class="search">
          <Search size={16} aria-hidden="true" />
          <span class="sr-only">Pesquisar no catálogo</span>
          <input
            type="search"
            placeholder="Pesquisar por viatura ou matrícula"
            bind:value={query}
          />
        </label>
        {#if drafts.length >= 4}<p class="context limit">
            Limite de quatro viaturas atingido.
          </p>{/if}
        <ul class="catalog-list" aria-label="Viaturas elegíveis">
          {#each available as vehicle (vehicle.id)}
            <li class:chosen={selected.has(vehicle.id)}>
              <div class="thumb"><CampaignVehiclePhoto vehicleId={vehicle.id} compact /></div>
              <div class="catalog-identity">
                <strong>{vehicle.brand} {vehicle.model}</strong>
                <span>{formatEUR(vehicle.price)}</span>
              </div>
              <button
                type="button"
                class="add"
                aria-label={selected.has(vehicle.id)
                  ? `${vehicle.brand} ${vehicle.model} adicionada`
                  : `Adicionar ${vehicle.brand} ${vehicle.model}`}
                disabled={selected.has(vehicle.id) || drafts.length >= 4 || busy}
                onclick={() => add(vehicle)}
              >
                {#if selected.has(vehicle.id)}<Check size={15} aria-hidden="true" /><span
                    >Adicionada</span
                  >
                {:else}<Plus size={15} aria-hidden="true" /><span>Adicionar</span>{/if}
              </button>
            </li>
          {:else}
            <li class="catalog-empty">
              {query ? 'Nenhuma viatura corresponde à pesquisa.' : 'Nenhuma viatura elegível.'}
            </li>
          {/each}
        </ul>
      </section>
    </div>
  {/if}
</section>

<style>
  .campaign-editor {
    max-width: 1260px;
    container-type: inline-size;
  }
  h2,
  h3,
  h4,
  p {
    margin: 0;
  }
  h2 {
    font-size: 24px;
    font-weight: 650;
  }
  h3 {
    font-size: 17px;
    font-weight: 650;
  }
  h4 {
    font-size: 19px;
    line-height: 1.2;
    font-weight: 650;
  }
  p {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 22px;
  }
  .heading p {
    margin-top: 5px;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: start;
    gap: clamp(14px, 2vw, 26px);
  }
  .campaigns {
    min-width: 0;
  }
  .panel-heading,
  .card-heading,
  .price-preview,
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .panel-heading {
    margin-bottom: 12px;
  }
  .count {
    color: var(--color-text-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .cards {
    display: grid;
    gap: 12px;
  }
  .campaign-card,
  .catalog,
  .empty {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
  }
  .campaign-card {
    overflow: hidden;
  }
  .card-photo {
    overflow: hidden;
  }
  .card-photo :global(.cover) {
    aspect-ratio: 2.2;
    border-radius: 0;
  }
  .card-content {
    display: grid;
    gap: 9px;
    padding: clamp(12px, 2vw, 20px);
  }
  .card-heading {
    align-items: start;
  }
  h4,
  #campaign-selected-title,
  #campaign-catalog-title {
    scroll-margin-block: 82px;
  }
  h4:focus-visible,
  #campaign-selected-title:focus-visible,
  #campaign-catalog-title:focus-visible {
    outline-offset: 4px;
  }
  .state {
    display: block;
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 650;
    color: var(--color-text-muted);
  }
  .state.active {
    color: var(--color-red);
  }
  .price-preview {
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 6px 12px;
  }
  .price-preview strong {
    font-size: clamp(21px, 3vw, 29px);
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  .price-preview s,
  .context {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .fields {
    display: grid;
    align-items: end;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 9px;
    min-width: 0;
    margin: 3px 0 0;
    padding: 0;
    border: 0;
  }
  .fields label {
    display: grid;
    align-content: end;
    min-width: 0;
    gap: 4px;
    font-size: 12px;
  }
  .fields input {
    width: 100%;
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 35px 12px;
    text-align: center;
    color: var(--color-text-muted);
  }
  .actions {
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-top: 14px;
  }
  .feedback:empty {
    position: absolute;
  }
  .error {
    color: var(--color-danger);
  }
  .catalog {
    padding: clamp(12px, 2vw, 18px);
  }
  .catalog-list {
    display: grid;
    gap: 6px;
    max-height: min(65dvh, 560px);
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
    padding: 2px;
    margin: 12px -2px -2px;
    list-style: none;
  }
  .catalog-list li {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    padding: 6px;
    transition:
      border-color 160ms ease,
      background-color 160ms ease;
  }
  .catalog-list .catalog-empty {
    display: block;
    padding: 14px;
    color: var(--color-text-muted);
    font-size: 13px;
  }
  .catalog-list li.chosen {
    border-color: color-mix(in srgb, var(--color-red) 65%, var(--color-border));
    background: color-mix(in srgb, var(--color-red) 5%, transparent);
  }
  .catalog-identity {
    display: grid;
    gap: 4px;
    font-size: 13px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
  .catalog-identity span {
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .search :global(svg) {
    flex: none;
    color: var(--color-text-muted);
  }
  .search input {
    width: 100%;
    min-width: 0;
  }
  .limit {
    margin-top: 8px;
  }
  .primary,
  .remove,
  .add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 44px;
    padding: 0 10px;
    border-radius: var(--radius-btn);
    font-size: 12px;
    font-weight: 650;
  }
  .primary {
    background: var(--color-red);
    color: white;
    padding-inline: 14px;
  }
  .primary:disabled,
  .add:disabled:not(.chosen .add) {
    opacity: 0.55;
  }
  .remove {
    flex: none;
    width: 44px;
    padding: 0;
    color: var(--color-text-muted);
  }
  .remove:hover {
    color: var(--color-danger);
  }
  .add {
    border: 1px solid var(--color-border-strong);
  }
  .add:not(:disabled):hover {
    border-color: var(--color-red);
  }
  .chosen .add {
    border-color: transparent;
  }
  .mobile-link {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .catalog-list li {
      transition: none;
    }
  }
  @media (max-width: 1000px) {
    .catalog-list li {
      grid-template-columns: 55px minmax(0, 1fr) auto;
    }
  }
  @container (max-width: 670px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .catalog-list {
      max-height: none;
      scrollbar-gutter: auto;
    }
    .mobile-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: 13px;
      text-decoration: underline;
    }
    .card-photo :global(.cover) {
      aspect-ratio: 1.95;
    }
  }
  @media (max-width: 370px) {
    .fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .catalog-list li {
      grid-template-columns: 48px minmax(0, 1fr) auto;
      gap: 5px;
    }
  }
</style>
