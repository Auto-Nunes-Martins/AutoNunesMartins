<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Tag, Trash2 } from 'lucide-svelte';
  import CampaignVehiclePhoto from '$lib/components/vehicle/CampaignVehiclePhoto.svelte';
  import VehicleCatalogue from '$lib/components/vehicle/VehicleCatalogue.svelte';
  import { formatEUR } from '$lib/utils/format';
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
      searchText(
        `${vehicle.brand} ${vehicle.model} ${vehicle.year} ${vehicle.licensePlate ?? ''}`,
      ).includes(searchText(query)),
    ),
  );
  const changed = $derived(
    drafts.length !== data.editor?.items.length ||
      drafts.some((draft) => draft.edited || !draft.saved),
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
      const base = Number(editor?.candidates.find(({ id }) => id === item.vehicleId)?.price);
      return {
        id: item.vehicleId,
        price: item.price.replace('.', ','),
        discount: discountFromBase(Number(item.price), base),
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

  function edit(draft: Draft) {
    draft.edited = true;
    draft.error = '';
    feedback = '';
    validation = '';
  }

  function updatePrice(draft: Draft, value: string) {
    draft.price = value;
    draft.discount = discountFromBase(cents(value) / 100, Number(vehicleById.get(draft.id)?.price));
    edit(draft);
  }

  function discountFromBase(price: number, base: number) {
    return price > 0 && price < base ? String(Math.round((1 - price / base) * 100)) : '';
  }

  function updateDiscount(draft: Draft, vehicle: Vehicle, value: string) {
    draft.discount = value;
    const percentage = Number(value);
    draft.price =
      /^\d{1,2}$/.test(value) && percentage >= 1
        ? (Math.round(Number(vehicle.price) * (100 - percentage)) / 100)
            .toFixed(2)
            .replace('.', ',')
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

  function prepareItems(selection = drafts) {
    const items = [];
    let firstInvalid: string | undefined;
    for (const draft of selection) {
      const vehicle = vehicleById.get(draft.id);
      const amount = cents(draft.price);
      const limit = cents(vehicle?.price ?? '');
      if (!vehicle) {
        draft.error = 'Retire esta viatura para guardar as campanhas.';
      } else if (!(amount > 0 && amount < limit)) {
        draft.error = 'Indique um preço positivo inferior ao preço base.';
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
          recheck: draft.edited,
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
      <p>Até quatro viaturas. O desconto compara sempre com o preço base.</p>
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
          <span
            class="count"
            title={drafts.length === 4 ? 'Limite de quatro viaturas atingido.' : undefined}
          >
            {drafts.length} / 4
          </span>
        </div>
        <form
          method="POST"
          novalidate
          use:enhance={({ formData, cancel }) => {
            if (busy) return cancel();
            const newDrafts = drafts.filter((draft) => !draft.saved);
            const adding =
              newDrafts.length === 1 &&
              drafts.length === (data.editor?.items.length ?? 0) + 1 &&
              !drafts.some((draft) => draft.saved && draft.edited);
            const items = prepareItems(adding ? newDrafts : drafts);
            if (!items) return cancel();
            const revision = data.editor?.revision;
            if (adding) {
              if (!items[0]) return cancel();
              const { vehicleId, price, durationDays } = items[0];
              formData.set(
                'addition',
                JSON.stringify({ revision, item: { vehicleId, price, durationDays } }),
              );
            } else {
              formData.set('campaigns', JSON.stringify({ revision, items }));
            }
            busy = true;
            validation = '';
            return async ({ result, update }) => {
              try {
                await update({ reset: false });
                if (result.type === 'success') feedback = 'Campanhas guardadas.';
                if (result.type === 'failure') {
                  validation =
                    result.status === 405 && !adding
                      ? 'Nesta pré-visualização, pode adicionar uma viatura de cada vez. Recarregue a página para descartar alterações por guardar e tente só a adição.'
                      : String(result.data?.error ?? 'Não foi possível guardar.');
                }
              } finally {
                busy = false;
              }
            };
          }}
        >
          <div class="cards">
            {#each drafts as draft (draft.id)}
              {@const vehicle = vehicleById.get(draft.id)}
              {@const applied =
                !!draft.saved && (draft.saved.applied || draft.saved.referencePrice !== null)}
              <article class="campaign-card" class:applied transition:fly={transitionOptions()}>
                {#if applied}
                  <div class="sale-ribbon" aria-hidden="true"><span>SALE</span></div>
                {/if}
                <div class="card-content">
                  <div class="card-heading">
                    {#if vehicle}
                      <div class="card-photo">
                        <CampaignVehiclePhoto vehicleId={vehicle.id} compact />
                      </div>
                    {/if}
                    <div>
                      {#if applied}
                        <span class="sr-only">Preço aplicado</span>
                      {:else}
                        <span class="state">{draft.saved ? 'Não publicada' : 'Por guardar'}</span>
                      {/if}
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
                    <div class="price-context">
                      <span>Preço base <strong>{formatEUR(vehicle.price)}</strong></span>
                    </div>
                    <fieldset disabled={busy} class="fields">
                      <legend class="sr-only"
                        >Editar campanha de {vehicle.brand} {vehicle.model}</legend
                      >
                      <label class="promotion-field">
                        <span>Preço de desconto</span>
                        <span class="input-control">
                          <input
                            value={draft.price}
                            data-inline-edit
                            aria-label="Preço de desconto (€)"
                            oninput={(event) => updatePrice(draft, event.currentTarget.value)}
                            inputmode="decimal"
                            placeholder="0,00"
                            required
                          />
                          <span aria-hidden="true">€</span>
                        </span>
                      </label>
                      <label>
                        <span>Diferença</span>
                        <span class="input-control">
                          <input
                            value={draft.discount}
                            data-inline-edit
                            aria-label="Diferença (%)"
                            oninput={(event) =>
                              updateDiscount(draft, vehicle, event.currentTarget.value)}
                            inputmode="numeric"
                            placeholder="0"
                            maxlength="2"
                          />
                          <span aria-hidden="true">%</span>
                        </span>
                      </label>
                      <label>
                        <span>Duração</span>
                        <span class="input-control">
                          <input
                            type="number"
                            data-inline-edit
                            aria-label="Duração (dias)"
                            min="1"
                            max="365"
                            bind:value={draft.days}
                            oninput={() => edit(draft)}
                            required
                          />
                          <span aria-hidden="true">dias</span>
                        </span>
                      </label>
                    </fieldset>
                    {#if draft.saved && !applied && !draft.edited}
                      <p class="context">Este preço ainda não está aplicado no site.</p>
                      <button
                        class="apply-price"
                        type="button"
                        disabled={busy}
                        onclick={() => edit(draft)}>Aplicar este preço</button
                      >
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

      <VehicleCatalogue
        vehicles={available}
        {selected}
        canAdd={!busy && drafts.length < 4}
        onAdd={add}
        bind:query
        searchLabel="Pesquisar no catálogo"
        placeholder="Marca, modelo, ano ou matrícula"
        empty={query ? 'Nenhuma viatura corresponde à pesquisa.' : 'Nenhuma viatura elegível.'}
        focusTarget="campaign-catalog-title"
        fixedHeight
      >
        {#snippet thumbnail(vehicle)}<CampaignVehiclePhoto
            vehicleId={vehicle.id}
            compact
          />{/snippet}
        {#snippet detail(vehicle)}{formatEUR(vehicle.price)}{/snippet}
      </VehicleCatalogue>
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
    padding: clamp(10px, 1.5vw, 16px);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
  }
  .panel-heading,
  .card-heading,
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
  .empty {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
  }
  .campaign-card {
    position: relative;
    overflow: hidden;
    background: var(--color-bg-0);
  }
  .sale-ribbon {
    position: absolute;
    inset: 0 0 auto auto;
    width: 62px;
    height: 62px;
    overflow: hidden;
    pointer-events: none;
  }
  .sale-ribbon span {
    position: absolute;
    top: 14px;
    right: -23px;
    width: 90px;
    background: #ba2532;
    color: white;
    font-size: 10px;
    font-weight: 750;
    line-height: 18px;
    letter-spacing: 0.08em;
    text-align: center;
    transform: rotate(45deg);
  }
  .card-photo {
    flex: 0 0 clamp(64px, 8vw, 96px);
    min-width: 0;
    overflow: hidden;
  }
  .card-photo :global(.cover) {
    aspect-ratio: 4 / 3;
  }
  .card-content {
    display: grid;
    gap: 8px;
    padding: clamp(10px, 1.4vw, 16px);
  }
  .card-heading {
    align-items: start;
  }
  .applied .card-heading {
    margin-right: 58px;
  }
  .card-heading > div:not(.card-photo) {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  h4,
  #campaign-selected-title {
    scroll-margin-block: 82px;
  }
  h4:focus-visible,
  #campaign-selected-title:focus-visible {
    outline-offset: 4px;
  }
  .state {
    display: block;
    margin-bottom: 5px;
    font-size: 11px;
    font-weight: 650;
    color: var(--color-text-muted);
  }
  .price-context {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    padding-block: 3px;
    color: var(--color-text-muted);
    font-size: 12px;
  }
  .price-context strong {
    margin-inline-start: 3px;
    color: var(--color-text);
    font-weight: 650;
  }
  .context {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .fields {
    display: grid;
    align-items: end;
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 0.8fr) minmax(0, 1fr);
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
    gap: 6px;
    font-size: 12px;
  }
  .input-control {
    display: flex;
    align-items: center;
    min-height: 44px;
    gap: 3px;
    padding-inline: 8px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    background: var(--color-bg-1);
  }
  .input-control > span {
    color: var(--color-text-muted);
    font: inherit;
    white-space: nowrap;
  }
  .input-control:focus-within {
    outline: 2px solid var(--color-red);
    outline-offset: 1px;
  }
  .input-control > input {
    flex: 1;
    width: 0;
    min-width: 0;
    min-height: 42px;
    padding: 0;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    background: transparent;
    color: var(--color-text);
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }
  .promotion-field .input-control {
    background: color-mix(in srgb, var(--color-red) 6%, var(--color-bg-1));
  }
  .promotion-field input {
    font-size: 19px;
    font-weight: 650;
  }
  .input-control > input[type='number'] {
    appearance: textfield;
  }
  .input-control > input[type='number']::-webkit-inner-spin-button {
    appearance: none;
  }
  .apply-price {
    justify-self: start;
    min-height: 44px;
    color: var(--color-text);
    text-decoration: underline;
  }
  .empty {
    display: grid;
    justify-items: center;
    align-content: center;
    min-height: 164px;
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
  .primary,
  .remove {
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
  .primary:disabled {
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
  .mobile-link {
    display: none;
  }
  @container (max-width: 670px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .mobile-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: 13px;
      text-decoration: underline;
    }
  }
  @media (max-width: 370px) {
    .fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .promotion-field {
      grid-column: 1 / -1;
    }
  }
</style>
