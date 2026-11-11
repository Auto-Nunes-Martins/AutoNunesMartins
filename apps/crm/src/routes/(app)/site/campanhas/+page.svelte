<script lang="ts">
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import { Plus, X } from 'lucide-svelte';
  import { formatEUR, formatLisbonDateTime } from '$lib/utils/format';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  type Item = NonNullable<PageData['editor']>['items'][number];
  type Draft = Omit<Item, 'durationDays' | 'startsAt' | 'endsAt'> & {
    durationDays: number | undefined;
    key: number;
  };
  let sequence = 0;
  const draftFrom = (items: Item[]): Draft[] =>
    items.map(({ vehicleId, price, referencePrice, evidence, durationDays }) => ({
      vehicleId,
      price,
      referencePrice,
      evidence,
      durationDays,
      key: sequence++,
    }));
  let items = $state<Draft[]>(untrack(() => draftFrom(data.editor?.items ?? [])));
  let revision = untrack(() => data.editor?.revision);
  let busy = $state(false);
  $effect(() => {
    if (data.editor && data.editor.revision !== revision) {
      revision = data.editor.revision;
      items = draftFrom(data.editor.items);
    }
  });

  function normalize(value: string) {
    const cleaned = value.trim().replace(',', '.');
    return /^\d{1,10}(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned).toFixed(2) : cleaned;
  }
  const payload = $derived(
    JSON.stringify({
      revision: data.editor?.revision ?? null,
      items: items.map(({ vehicleId, price, referencePrice, evidence, durationDays }) => ({
        vehicleId,
        price: normalize(price),
        referencePrice: normalize(referencePrice),
        evidence,
        durationDays,
      })),
    }),
  );
  function add() {
    items = [
      ...items,
      {
        vehicleId: '',
        price: '',
        referencePrice: '',
        evidence: '',
        durationDays: 7,
        key: sequence++,
      },
    ];
  }
</script>

<svelte:head><title>Campanhas · Site público · Auto Nunes Martins</title></svelte:head>

<section class="campaign-editor" aria-labelledby="campaign-heading">
  <h2 id="campaign-heading">Campanhas</h2>
  <p>
    Escolha até quatro viaturas disponíveis. As novas promoções começam ao guardar e terminam após o
    período indicado.
  </p>
  {#if !data.editor}
    <p role="alert">
      Não foi possível carregar as campanhas. Atualize a página para tentar novamente.
    </p>
  {:else}
    <form
      method="POST"
      use:enhance={() => {
        busy = true;
        return async ({ update }) => {
          try {
            await update({ reset: false });
          } finally {
            busy = false;
          }
        };
      }}
    >
      <input type="hidden" name="campaigns" value={payload} />
      {#each items as item, index (item.key)}
        {@const candidate = data.editor.candidates.find(({ id }) => id === item.vehicleId)}
        {@const saved = data.editor.items.find(({ vehicleId }) => vehicleId === item.vehicleId)}
        <fieldset disabled={busy}>
          <legend>Viatura {index + 1}</legend>
          <div class="vehicle-row">
            <label>
              <span id={`campaign-vehicle-${item.key}`}>Viatura</span>
              <select
                aria-labelledby={`campaign-vehicle-${item.key}`}
                bind:value={item.vehicleId}
                required
              >
                <option value="">Escolher viatura</option>
                {#if item.vehicleId && !candidate}
                  <option value={item.vehicleId}
                    >Viatura indisponível · remover ou substituir</option
                  >
                {/if}
                {#each data.editor.candidates as vehicle (vehicle.id)}
                  <option
                    value={vehicle.id}
                    disabled={items.some(
                      (other) => other !== item && other.vehicleId === vehicle.id,
                    )}
                  >
                    {vehicle.brand}
                    {vehicle.model} · {vehicle.year}{vehicle.licensePlate
                      ? ` · ${vehicle.licensePlate}`
                      : ''}
                  </option>
                {/each}
              </select>
            </label>
            <button
              type="button"
              class="remove"
              aria-label={`Remover viatura ${index + 1}`}
              onclick={() => (items = items.filter((other) => other !== item))}
              ><X size={18} /></button
            >
          </div>
          {#if candidate}<p class="normal-price">
              Preço público normal: {formatEUR(candidate.price)}
            </p>{/if}
          <div class="terms">
            <label
              >Preço promocional (€)<input
                bind:value={item.price}
                inputmode="decimal"
                required
              /></label
            >
            <label
              >Preço mais baixo dos 30 dias anteriores (€)<input
                bind:value={item.referencePrice}
                inputmode="decimal"
                required
              /></label
            >
            <label
              >Duração (dias)<input
                type="number"
                min="1"
                max="365"
                bind:value={item.durationDays}
                required
              /></label
            >
          </div>
          <label>
            Referência documental
            <input
              bind:value={item.evidence}
              minlength="3"
              maxlength="400"
              placeholder="Ex.: registo de preços, referência e data"
              required
            />
          </label>
          {#if saved}<p class="normal-price">
              Guardada de {formatLisbonDateTime(saved.startsAt)} a {formatLisbonDateTime(
                saved.endsAt,
              )} (Lisboa).
            </p>{/if}
        </fieldset>
      {:else}
        <p class="empty">Nenhuma campanha selecionada.</p>
      {/each}
      <div class="actions">
        <button
          type="button"
          onclick={add}
          disabled={busy || items.length >= 4 || !data.editor.candidates.length}
          ><Plus size={16} />Adicionar viatura</button
        >
        <button class="save" type="submit" disabled={busy}
          >{busy ? 'A guardar…' : 'Guardar campanhas'}</button
        >
      </div>
      {#if form?.error}<p role="alert" class="error">{form.error}</p>{/if}
      {#if form?.saved}<p role="status">Campanhas guardadas.</p>{/if}
    </form>
  {/if}
</section>

<style>
  .campaign-editor {
    max-width: 940px;
  }
  h2 {
    font-size: 24px;
    font-weight: 650;
    margin: 0 0 8px;
  }
  p {
    color: var(--color-text-muted);
    margin: 0 0 16px;
    font-size: 14px;
  }
  form {
    display: grid;
    gap: 16px;
  }
  fieldset {
    min-width: 0;
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-1);
  }
  legend {
    padding: 0 6px;
    font-size: 13px;
    font-weight: 600;
  }
  label {
    display: grid;
    align-content: end;
    gap: 6px;
    min-width: 0;
    font-size: 13px;
  }
  input,
  select {
    width: 100%;
    min-height: 42px;
    padding: 8px 10px;
    color: var(--color-text);
    background: var(--color-bg-0);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
  }
  .vehicle-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 10px;
  }
  .terms {
    display: grid;
    grid-template-columns: 1fr 1.5fr 0.7fr;
    gap: 12px;
  }
  .normal-price {
    font-size: 12px;
    margin: 0;
  }
  .empty {
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--radius-card);
    padding: 20px;
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 44px;
    padding: 0 14px;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-btn);
    font-size: 13px;
  }
  .save {
    background: var(--color-red);
    border-color: var(--color-red);
    color: white;
    font-weight: 600;
  }
  .remove {
    width: 44px;
    padding: 0;
  }
  .error {
    color: var(--color-danger);
  }
  @media (max-width: 620px) {
    .terms {
      grid-template-columns: 1fr;
    }
  }
</style>
