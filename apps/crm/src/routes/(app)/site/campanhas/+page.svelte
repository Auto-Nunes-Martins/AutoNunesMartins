<script lang="ts">
  import { enhance } from '$app/forms';
  import { tick, untrack } from 'svelte';
  import { ArrowUpRight, Plus, Tag, Trash2, X } from 'lucide-svelte';
  import CampaignVehiclePhoto from '$lib/components/vehicle/CampaignVehiclePhoto.svelte';
  import { formatEUR, formatLisbonDateTime } from '$lib/utils/format';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  type Editor = NonNullable<PageData['editor']>;
  type Item = Editor['items'][number];
  type Input = {
    vehicleId: string;
    price: string;
    durationDays: number | undefined;
    recheck?: boolean;
  };
  let dialog: HTMLDialogElement;
  let selected = $state<Item>();
  let vehicleId = $state('');
  let price = $state('');
  let discount = $state('');
  let durationDays = $state<number | undefined>(7);
  let busy = $state(false);
  let validation = $state('');
  const items = $derived(data.editor?.items ?? []);
  const candidate = $derived(data.editor?.candidates.find((vehicle) => vehicle.id === vehicleId));
  const ceiling = $derived(Number(candidate?.referencePrice ?? candidate?.price));
  const existingReference = $derived(
    selected?.referencePrice && Number(price.replace(',', '.')) === Number(selected.price)
      ? Number(selected.referencePrice)
      : null,
  );

  function cents(value: string) {
    const cleaned = value.trim().replace(',', '.');
    return /^\d{1,10}(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : NaN;
  }

  function percent(amount: number, reference: number) {
    return Math.round((1 - amount / reference) * 100);
  }

  function updatePrice(value: string) {
    price = value;
    const amount = cents(value) / 100;
    const reference = existingReference ?? ceiling;
    discount = amount > 0 && amount <= reference ? String(percent(amount, reference)) : '';
    validation = '';
  }

  function updateDiscount(value: string) {
    discount = value;
    if (/^\d{1,2}$/.test(value) && Number(value) >= 1 && ceiling > 0) {
      price = (Math.round(ceiling * (100 - Number(value))) / 100).toFixed(2);
    } else {
      price = '';
    }
    validation = '';
  }

  async function open(item?: Item) {
    validation = '';
    selected = item;
    vehicleId = item?.vehicleId ?? '';
    durationDays = item?.durationDays ?? 7;
    untrack(() => updatePrice(item?.price ?? ''));
    await tick();
    dialog.showModal();
  }

  function changeVehicle(event: Event) {
    vehicleId = (event.currentTarget as HTMLSelectElement).value;
    updatePrice('');
  }

  function input(item: Item): Input {
    return { vehicleId: item.vehicleId, price: item.price, durationDays: item.durationDays };
  }

  function prepareItems(remove: boolean): Input[] | undefined {
    if (busy) return;
    const amount = cents(price);
    if (
      !remove &&
      (!candidate ||
        !(amount > 0 && amount < Math.round((existingReference ?? ceiling) * 100)) ||
        !durationDays ||
        !Number.isInteger(durationDays) ||
        durationDays > 365 ||
        durationDays < 1)
    ) {
      validation =
        'Indique um preço positivo inferior ao preço de referência e uma duração de 1 a 365 dias.';
      return;
    }
    const replacement = {
      vehicleId,
      price: (amount / 100).toFixed(2),
      durationDays,
      recheck: true,
    };
    return selected
      ? items.flatMap((item) =>
          item.vehicleId !== selected?.vehicleId ? [input(item)] : remove ? [] : [replacement],
        )
      : [...items.map(input), replacement];
  }
</script>

<svelte:head><title>Campanhas · Site público · Auto Nunes Martins</title></svelte:head>

<section class="campaign-editor" aria-labelledby="campaign-heading">
  <div class="heading">
    <div>
      <h2 id="campaign-heading">Campanhas</h2>
      <p>Escolha até quatro viaturas para a secção Campanhas do site.</p>
    </div>
    {#if data.editor}
      <button
        class="primary"
        type="button"
        onclick={() => open()}
        disabled={items.length >= 4 ||
          !data.editor.candidates.some(({ id }) => !items.some((item) => item.vehicleId === id))}
      >
        <Plus size={17} aria-hidden="true" /> Adicionar viatura
      </button>
    {/if}
  </div>

  {#if !data.editor}
    <p role="alert">
      Não foi possível carregar as campanhas. Atualize a página para tentar novamente.
    </p>
  {:else}
    <div class="cards">
      {#each items as item (item.vehicleId)}
        {@const car = data.editor.candidates.find(({ id }) => id === item.vehicleId)}
        <button class="card" type="button" onclick={() => open(item)}>
          <CampaignVehiclePhoto vehicleId={car?.id ?? ''} />
          <span class="card-body">
            <span class="card-title">
              <strong>{car ? `${car.brand} ${car.model}` : 'Viatura indisponível'}</strong>
              <ArrowUpRight size={18} aria-hidden="true" />
            </span>
            <span class="price-row">
              <strong>{formatEUR(item.price)}</strong>
              {#if item.referencePrice}<s>{formatEUR(item.referencePrice)}</s>{:else}<span
                  >Em preparação</span
                >{/if}
            </span>
          </span>
        </button>
      {:else}
        <div class="empty">
          <Tag size={25} aria-hidden="true" />
          <p>Nenhuma campanha selecionada.</p>
        </div>
      {/each}
    </div>
    {#if form?.saved}<p role="status">Campanhas guardadas.</p>{/if}

    <dialog
      bind:this={dialog}
      aria-labelledby="campaign-dialog-title"
      oncancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <form
        class="edit"
        method="POST"
        use:enhance={({ submitter, formData, cancel }) => {
          const next = prepareItems(submitter?.getAttribute('value') === 'remove');
          if (!next) return cancel();
          formData.set(
            'campaigns',
            JSON.stringify({ revision: data.editor?.revision, items: next }),
          );
          busy = true;
          return async ({ result, update }) => {
            try {
              await update({ reset: false });
              if (result.type === 'success') dialog.close();
              if (result.type === 'failure')
                validation = String(result.data?.error ?? 'Não foi possível guardar.');
            } finally {
              busy = false;
            }
          };
        }}
      >
        <div class="dialog-heading">
          <h3 id="campaign-dialog-title">
            {candidate ? `${candidate.brand} ${candidate.model}` : 'Nova campanha'}
          </h3>
          <button
            type="button"
            class="icon"
            aria-label="Fechar editor"
            onclick={() => dialog.close()}
            disabled={busy}><X size={20} /></button
          >
        </div>
        {#if !selected}
          <label for="campaign-vehicle">Viatura</label>
          <select id="campaign-vehicle" value={vehicleId} onchange={changeVehicle} required>
            <option value="">Escolher viatura</option>
            {#each data.editor.candidates.filter(({ id }) => !items.some((item) => item.vehicleId === id)) as car (car.id)}
              <option value={car.id}
                >{car.brand}
                {car.model} · {car.year}{car.licensePlate ? ` · ${car.licensePlate}` : ''}</option
              >
            {/each}
          </select>
        {/if}
        {#if candidate}
          {#if !selected}<CampaignVehiclePhoto {vehicleId} />{/if}
          <div class="prices">
            <label
              >Preço promocional (€)
              <input
                class="promo"
                value={price}
                oninput={(event) => updatePrice(event.currentTarget.value)}
                inputmode="decimal"
                required
              />
            </label>
            <label
              >Desconto (%)
              <input
                value={discount}
                oninput={(event) => updateDiscount(event.currentTarget.value)}
                inputmode="numeric"
                maxlength="2"
              />
            </label>
          </div>
          <p class="context">Preço público normal · {formatEUR(candidate.price)}</p>
          {#if !candidate.referencePrice && !existingReference}
            <p class="context">
              Pode guardar em preparação. A campanha só fica visível quando houver 30 dias de
              histórico de preços e voltar a guardar.
            </p>
          {/if}
          <label
            >Duração (dias)
            <input type="number" min="1" max="365" bind:value={durationDays} required />
          </label>
          {#if selected?.referencePrice}
            <p class="context">
              Guardada de {formatLisbonDateTime(selected.startsAt)} a {formatLisbonDateTime(
                selected.endsAt,
              )} (Lisboa).
            </p>
          {/if}
        {/if}
        {#if validation}<p class="error" role="alert">
            {validation}
          </p>{/if}
        <div class="actions">
          {#if selected}
            <button
              type="submit"
              value="remove"
              formnovalidate
              class="remove"
              aria-label="Remover campanha"
              disabled={busy}><Trash2 size={16} aria-hidden="true" /> Remover</button
            >
          {/if}
          <button class="primary" type="submit" disabled={busy || !candidate}
            >{busy ? 'A guardar…' : 'Guardar campanha'}</button
          >
        </div>
      </form>
    </dialog>
  {/if}
</section>

<style>
  .campaign-editor {
    max-width: 1080px;
  }
  .heading,
  .dialog-heading,
  .card-title,
  .price-row,
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .heading {
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-size: 24px;
    font-weight: 650;
    margin-bottom: 6px;
  }
  h3 {
    font-size: 20px;
    font-weight: 650;
  }
  p {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  [role='status'] {
    margin-top: 12px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 235px), 1fr));
    gap: 14px;
  }
  .card {
    display: grid;
    padding: 8px;
    background: var(--color-bg-1);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    text-align: start;
  }
  .card:hover {
    border-color: var(--color-red);
  }
  .card-body {
    display: grid;
    gap: 8px;
    padding: 12px 8px 8px;
  }
  .card-title strong {
    overflow-wrap: anywhere;
  }
  .card-title :global(svg) {
    flex: none;
  }
  .price-row {
    justify-content: flex-start;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .price-row strong {
    font-size: 22px;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }
  .empty {
    grid-column: 1 / -1;
    display: grid;
    justify-items: center;
    gap: 10px;
    padding: 36px 16px;
    color: var(--color-text-muted);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-card);
  }
  dialog {
    inset: 0;
    margin: auto;
    width: min(520px, calc(100% - 28px));
    max-height: calc(100dvh - 28px);
    overflow: auto;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-card);
    color: var(--color-text);
    background: var(--color-bg-1);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 62%);
  }
  .edit {
    display: grid;
    gap: 12px;
    padding: clamp(14px, 4vw, 24px);
  }
  .edit :global(.cover) {
    max-height: 160px;
    width: 100%;
  }
  .prices {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
    gap: 10px;
  }
  label {
    display: grid;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
  }
  input,
  select {
    width: 100%;
  }
  .promo.promo {
    font-size: 20px;
    font-weight: 650;
  }
  .context {
    font-size: 12px;
  }
  .actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .primary,
  .icon,
  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 44px;
    padding: 0 14px;
    border-radius: var(--radius-btn);
    font-size: 13px;
  }
  .primary {
    background: var(--color-red);
    color: white;
    font-weight: 650;
  }
  .icon {
    width: 44px;
    padding: 0;
    flex: none;
  }
  .remove {
    margin-right: auto;
    color: var(--color-text-muted);
  }
  .remove:hover,
  .error {
    color: var(--color-danger);
  }
</style>
