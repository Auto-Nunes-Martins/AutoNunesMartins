<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick, untrack } from 'svelte';
  import { flip } from 'svelte/animate';
  import { reorderMotion } from '$lib/reorderMotion';
  import { Tag } from 'lucide-svelte';
  import SelectionOrderActions from '$lib/components/site/SelectionOrderActions.svelte';
  import CampaignRemaining from '$lib/components/site/CampaignRemaining.svelte';
  import PromotionRibbon from '../../../../../../../shared/ui/PromotionRibbon.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import CampaignVehiclePhoto from '$lib/components/vehicle/CampaignVehiclePhoto.svelte';
  import CampaignFramingEditor from '$lib/components/vehicle/CampaignFramingEditor.svelte';
  import VehicleCatalogue from '$lib/components/vehicle/VehicleCatalogue.svelte';
  import { formatEUR } from '$lib/utils/format';
  import { toast } from 'svelte-sonner';
  import { siteSavedFeedback, type SiteSaveSummary } from '$lib/components/site/siteSaveFeedback';
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
    applyRequested?: boolean;
    error?: string;
  };

  let drafts = $state<Draft[]>(untrack(() => initialDrafts(data.editor)));
  let revision = untrack(() => data.editor?.revision);
  let query = $state('');
  let busy = $state(false);
  let framingOpen = $state<Record<string, boolean>>({});
  let reordering = $state(false);
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
      drafts.some((draft, index) => draftChanged(draft) || draft.id !== data.editor?.items[index]?.vehicleId),
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
      };
    });
  }

  function cents(value: string) {
    const cleaned = value.trim().replace(',', '.');
    return /^\d{1,10}(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : NaN;
  }

  function draftChanged(draft: Draft) {
    return !draft.saved || !!draft.applyRequested ||
      cents(draft.price) !== cents(draft.saved.price) ||
      draft.days !== draft.saved.durationDays;
  }

  function edit(draft: Draft) {
    draft.error = '';
    feedback = '';
    validation = '';
  }

  function numericInput(input: HTMLInputElement, decimals = true) {
    const clean = (value: string) => {
      let separator = false;
      return [...value]
        .filter((character) => {
          if (/[0-9]/.test(character)) return true;
          if (decimals && !separator && /[.,]/.test(character)) {
            separator = true;
            return true;
          }
          return false;
        })
        .join('');
    };
    const caret = input.selectionStart;
    const value = clean(input.value);
    if (input.value !== value) {
      const position = caret === null ? null : clean(input.value.slice(0, caret)).length;
      input.value = value;
      if (position !== null) input.setSelectionRange(position, position);
    }
    return value;
  }

  function updateDays(draft: Draft, input: HTMLInputElement) {
    const value = numericInput(input, false);
    draft.days = value ? Number(value) : undefined;
    edit(draft);
  }

  function updatePrice(draft: Draft, value: string) {
    draft.price = value;
    draft.discount = discountFromBase(cents(value) / 100, Number(vehicleById.get(draft.id)?.price));
    edit(draft);
  }

  function discountFromBase(price: number, base: number) {
    return price > 0 && price < base
      ? ((Math.round(base * 100) - Math.round(price * 100)) / 100).toFixed(2).replace('.', ',')
      : '';
  }

  function updateDiscount(draft: Draft, vehicle: Vehicle, value: string) {
    draft.discount = value;
    const difference = cents(value);
    const base = cents(vehicle.price);
    draft.price =
      difference > 0 && difference < base
        ? ((base - difference) / 100).toFixed(2).replace('.', ',')
        : '';
    edit(draft);
  }

  function saveSummary(): SiteSaveSummary {
    const modified = drafts.filter((draft) => draftChanged(draft));
    const removed = (data.editor?.items ?? []).filter((item) => !selected.has(item.vehicleId));
    const count = modified.length + removed.length;
    if (!count) return {
      kind: 'campaign', title: 'Ordem das campanhas atualizada',
      label: `${drafts.length} viaturas ordenadas`,
      detail: 'A ordem de apresentação no site foi guardada.',
    };
    if (count === 1) {
      const draft = modified[0];
      const id = draft?.id ?? removed[0]!.vehicleId;
      const vehicle = vehicleById.get(id);
      return {
        kind: 'campaign',
        title: draft
          ? draft.saved
            ? 'Campanha atualizada'
            : 'Viatura adicionada à campanha'
          : 'Viatura retirada da campanha',
        label: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Viatura',
        vehicleId: vehicle ? id : undefined,
        detail: draft
          ? `${draft.days} ${draft.days === 1 ? 'dia' : 'dias'} · ${formatEUR(cents(draft.price) / 100)} · Poupança de ${formatEUR(cents(draft.discount) / 100)}`
          : 'A seleção de campanhas foi guardada.',
      };
    }
    return {
      kind: 'campaign',
      title: 'Campanhas guardadas',
      label: `${count} alterações guardadas`,
      detail: drafts.length
        ? `${drafts.length} ${drafts.length === 1 ? 'viatura na seleção de campanhas.' : 'viaturas na seleção de campanhas.'}`
        : 'A seleção de campanhas ficou vazia.',
    };
  }

  async function focusAt(id: string) {
    await tick();
    const target = document.getElementById(id);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function add(vehicle: Vehicle) {
    if (drafts.length >= 4 || selected.has(vehicle.id) || busy) return;
    reordering = true;
    drafts = [...drafts, { id: vehicle.id, price: '', discount: '', days: 7 }];
    feedback = `${vehicle.brand} ${vehicle.model} adicionada à seleção.`;
    validation = '';
    void focusAt(`campaign-${vehicle.id}`);
  }

  function remove(draft: Draft) {
    reordering = true;
    const index = drafts.findIndex(({ id }) => id === draft.id);
    drafts = drafts.filter(({ id }) => id !== draft.id);
    feedback = 'Viatura retirada da seleção.';
    validation = '';
    const nearby = drafts[Math.min(index, drafts.length - 1)];
    void focusAt(nearby ? `campaign-${nearby.id}` : 'campaign-selected-title');
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (busy || target < 0 || target >= drafts.length) return;
    reordering = true;
    const next = [...drafts];
    [next[index], next[target]] = [next[target]!, next[index]!];
    drafts = next;
    feedback = `Campanha movida para a posição ${target + 1}. Guarde para atualizar o site.`;
    validation = '';
  }

  function toggleFraming(id: string) {
    reordering = false;
    framingOpen[id] = !framingOpen[id];
  }

  function savingAmount(draft: Draft, vehicle: Vehicle | undefined) {
    const base = cents(vehicle?.price ?? '');
    const price = cents(draft.price);
    return price > 0 && price < base ? (base - price) / 100 : 0;
  }

  const ribbonPrice = new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2,
  });

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
          recheck: draftChanged(draft),
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
        <Panel>
          <PanelHeader
            icon={Tag}
            title="Viaturas em campanha"
            focusTarget="campaign-selected-title"
          >
            {#snippet actions()}
              <span
                class="count"
                title={drafts.length === 4 ? 'Limite de quatro viaturas atingido.' : undefined}
                >{drafts.length} / 4</span
              >
            {/snippet}
          </PanelHeader>
          <form
            method="POST"
            novalidate
            use:enhance={({ formData, cancel }) => {
              if (busy || !changed) return cancel();
              const newDrafts = drafts.filter((draft) => !draft.saved);
              const adding =
                newDrafts.length === 1 &&
                drafts.length === (data.editor?.items.length ?? 0) + 1 &&
                data.editor?.items.every((item, index) => drafts[index]?.id === item.vehicleId) &&
                !drafts.some((draft) => draft.saved && draftChanged(draft));
              const items = prepareItems(adding ? newDrafts : drafts);
              if (!items) return cancel();
              const summary = saveSummary();
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
                  if (result.type === 'success') {
                    feedback = 'Campanhas guardadas.';
                    siteSavedFeedback(summary);
                  }
                  if (result.type === 'failure') {
                    validation =
                      result.status === 405 && !adding
                        ? 'Nesta pré-visualização, pode adicionar uma viatura de cada vez. Recarregue a página para descartar alterações por guardar e tente só a adição.'
                        : String(result.data?.error ?? 'Não foi possível guardar.');
                    toast.error(validation);
                  }
                } finally {
                  busy = false;
                }
              };
            }}
          >
            <div class="cards">
              {#each drafts as draft, index (draft.id)}
                {@const vehicle = vehicleById.get(draft.id)}
                {@const applied =
                  !!draft.saved && (draft.saved.applied || draft.saved.referencePrice !== null)}
                {@const saving = savingAmount(draft, vehicle)}
                <div class="campaign-row" animate:flip={{ ...reorderMotion(), duration: reordering ? reorderMotion().duration : 0 }}>
                  <span class="campaign-position" aria-label={`Posição ${index + 1} no site`}>{String(index + 1).padStart(2, '0')}</span>
                <article class="campaign-card" class:applied data-campaign-vehicle={draft.id}>
                  <PromotionRibbon label={saving ? `−${ribbonPrice.format(saving)}` : 'SALE'} ariaLabel={saving ? `${formatEUR(saving)} de desconto` : 'Campanha sem desconto definido'} scale={0.78} />
                  <div class="card-content">
                    <div class="campaign-meta">{#if applied && draft.saved}<CampaignRemaining endsAt={draft.saved.endsAt} />{:else}<span class="state">{draft.saved ? 'Não publicada' : 'Por guardar'}</span>{/if}</div>
                    <div class="card-heading">
                      {#if vehicle}
                        <div class="card-photo">
                          <CampaignVehiclePhoto vehicleId={vehicle.id} compact />
                          <button
                            type="button"
                            class="frame-photo"
                            disabled={busy}
                            aria-expanded={!!framingOpen[vehicle.id]}
                            aria-controls={framingOpen[vehicle.id] ? `campaign-framing-${vehicle.id}` : undefined}
                            onclick={() => toggleFraming(vehicle.id)}
                          >Enquadrar</button>
                        </div>
                      {/if}
                      <div class="vehicle-info">
                        <h4
                          id={`campaign-${draft.id}`}
                          tabindex="-1"
                          aria-describedby={draft.error ? `error-${draft.id}` : undefined}
                        >
                          {vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Viatura indisponível'}
                        </h4>
                        {#if vehicle}
                          <div class="price-context">
                            <span>Preço base</span>
                            <strong class:discounted={saving > 0}>{formatEUR(vehicle.price)}</strong>
                          </div>
                        {/if}
                      </div>
                      <SelectionOrderActions {index} count={drafts.length} kind="campanha" disabled={busy} removeLabel={vehicle ? 'Remover ' + vehicle.brand + ' ' + vehicle.model : 'Remover viatura indisponível'} onmove={(direction) => move(index, direction)} onremove={() => remove(draft)} />
                    </div>
                    {#if vehicle}
                      {#key vehicle.id}<CampaignFramingEditor vehicleId={vehicle.id} disabled={busy} open={!!framingOpen[vehicle.id]} />{/key}
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
                              oninput={(event) =>
                                updatePrice(draft, numericInput(event.currentTarget))}
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
                              aria-label="Diferença (€)"
                              oninput={(event) =>
                                updateDiscount(draft, vehicle, numericInput(event.currentTarget))}
                              inputmode="decimal"
                              placeholder="0,00"
                            />
                            <span aria-hidden="true">€</span>
                          </span>
                        </label>
                        <label>
                          <span>Duração</span>
                          <span class="input-control">
                            <input
                              type="text"
                              inputmode="numeric"
                              data-inline-edit
                              aria-label="Duração (dias)"
                              value={draft.days ?? ''}
                              oninput={(event) => updateDays(draft, event.currentTarget)}
                              required
                            />
                            <span aria-hidden="true">dias</span>
                          </span>
                        </label>
                      </fieldset>
                      {#if draft.saved && !applied && !draftChanged(draft)}
                        <p class="context">Este preço ainda não está aplicado no site.</p>
                        <button
                          class="apply-price"
                          type="button"
                          disabled={busy}
                          onclick={() => { draft.applyRequested = true; edit(draft); }}>Aplicar este preço</button
                        >
                      {/if}
                    {/if}
                    {#if draft.error}<p class="error" role="alert" id={`error-${draft.id}`}>
                        {draft.error}
                      </p>{/if}

                  </div>
                </article>
                </div>
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
        </Panel>
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
    max-width: 1480px;
    container-type: inline-size;
  }
  h2,
  h4,
  p {
    margin: 0;
  }
  h2 {
    font-size: 24px;
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
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
    align-items: start;
    gap: clamp(14px, 2vw, 26px);
  }
  .campaigns {
    min-width: 0;
  }
  .campaigns form {
    padding: clamp(12px, 2vw, 20px);
    container-type: inline-size;
  }
  .card-heading,
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .count {
    color: var(--color-text-muted);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .cards {
    overflow-anchor: none;
    display: grid;
    gap: 12px;
  }
  .campaign-row {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 6px;
    align-items: start;
  }
  .campaign-position {
    align-self: center;
    text-align: center;
    color: var(--color-red);
    font-family: var(--font-mono, monospace);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
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
  .card-photo {
    flex: 0 0 clamp(92px, 10vw, 128px);
    min-width: 0;
    overflow: hidden;
  }
  .frame-photo {
    display: block;
    width: 100%;
    min-height: 36px;
    margin-top: 6px;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    background: var(--color-bg-1);
    color: var(--color-text);
    font-size: 12px;
    line-height: 1.4;
  }
  .frame-photo:disabled {
    opacity: 0.5;
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
    align-items: center;
    flex-wrap: wrap;
    padding-top: 10px;
    gap: 14px;
  }

  .card-heading > div:not(.card-photo) {
    flex: 1;
    min-width: 100px;
    overflow-wrap: anywhere;
  }
  h4 {
    scroll-margin-block: 82px;
  }
  h4:focus-visible {
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
    display: grid;
    gap: 4px;
    margin-top: 14px;
    color: var(--color-text-muted);
    font-size: 11px;
  }
  .price-context strong {
    font-size: 17px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .price-context strong.discounted {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
    text-decoration-color: var(--color-text-muted);
  }
  .campaign-meta { display: flex; align-items: center; min-height: 28px; padding-right: 80px; }
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
  .primary {
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
  @container (max-width: 400px) {
    .campaign-row { grid-template-columns: 16px minmax(0, 1fr); gap: 4px; }
    .campaign-position { font-size: 11px; }
    .card-heading { gap: 10px; padding-top: 14px; }
    .card-photo { flex-basis: 92px; }
    h4 { font-size: 16px; }
    .price-context { margin-top: 10px; }
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
