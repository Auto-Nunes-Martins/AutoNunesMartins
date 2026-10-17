<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { enhance } from '$app/forms';
  import { formFeedback, markFormSaved, showFormErrors } from '$lib/forms/formFeedback';
  import { tick, type Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import Button from '$lib/components/common/Button.svelte';
  import type { Fuel, VehicleStatus } from '@anm/types';

  type Initial = {
    brand?: string;
    model?: string;
    year?: number | null;
    fuel?: Fuel | '';
    mileage?: number | null;
    vin?: string;
    licensePlate?: string | null;
    purchasePrice?: string;
    salePrice?: string;
    status?: VehicleStatus;
    acquisitionDate?: string;
    description?: string;
    pendingDocFlags?: {
      financing: boolean;
      imt: boolean;
      registration: boolean;
      docs: boolean;
    };
  };

  interface Props {
    initial?: Initial;
    submitLabel?: string;
    /** Independent actions rendered outside the edit form (e.g. delete on edit). */
    extraActions?: Snippet;
    /** Defaults to `?/submit` form action on the same page. */
    action?: string;
    /** If true, after success goto vehicle detail using returned id. */
    redirectOnSuccess?: boolean;
    /** Sale prices remain editable; status changes belong to the sale workflow. */
    saleRecorded?: boolean;
    requireChanges?: boolean;
    disabled?: boolean;
    submitting?: boolean;
    unified?: boolean;
    onsaveall?: () => void;
    onstatechange?: (state: { dirty: boolean; valid: boolean }) => void;
  }

  let {
    initial = {},
    submitLabel = 'Guardar',
    extraActions,
    action,
    redirectOnSuccess = true,
    saleRecorded = false,
    requireChanges = false,
    disabled = false,
    submitting = $bindable(false),
    unified = false,
    onsaveall,
    onstatechange,
  }: Props = $props();

  let dirty = $state(false);
  let valid = $state(false);
  const formId = $props.id();

  const FUELS: { value: Fuel; label: string }[] = [
    { value: 'GASOLINE', label: 'Gasolina' },
    { value: 'DIESEL', label: 'Gasóleo' },
    { value: 'HYBRID', label: 'Híbrido' },
    { value: 'PLUGIN_HYBRID', label: 'Híbrido Plug-in' },
    { value: 'ELECTRIC', label: 'Elétrico' },
    { value: 'LPG', label: 'GPL' },
  ];

  const STATUSES: { value: VehicleStatus; label: string }[] = [
    { value: 'AVAILABLE', label: 'Disponível' },
    { value: 'RESERVED', label: 'Reservado' },
    { value: 'DOCS_PENDING', label: 'Documentos Pendentes' },
  ];

  function fieldLabelClass() {
    return 'font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-1.5';
  }

  function inputClass() {
    return 'h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors';
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultAcquisitionDate = $derived(initial.acquisitionDate ?? today);

  // Matrícula auto-formatter. Reactive: typing reformats the value so the
  // user sees "12-AB-34" as they go instead of having to hit the dashes
  // themselves. Stripping non-alphanumerics first, capping at 6 chars,
  // then re-grouping in pairs separated by "-".
  // The plate is an editable local draft, initialized once when the form mounts.
  const initialPlate = () => initial.licensePlate ?? '';
  let licensePlateInput = $state(initialPlate());
  function formatPlate(raw: string): string {
    const compact = raw
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 6);
    if (compact.length <= 2) return compact;
    if (compact.length <= 4) return `${compact.slice(0, 2)}-${compact.slice(2)}`;
    return `${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4)}`;
  }
  function onPlateInput(e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    licensePlateInput = formatPlate(el.value);
  }
</script>

<div class="space-y-6">
  <form
    id={formId}
    data-edit-vehicle
    novalidate={unified}
    method="POST"
    action={action ?? '?/submit'}
    use:formFeedback={{ onstatechange: state => { dirty = state.dirty; valid = state.valid; onstatechange?.(state); } }}
    use:enhance={({ formElement, cancel }) => {
      if (unified) { cancel(); onsaveall?.(); return; }
      if (submitting || disabled || !valid || (requireChanges && !dirty)) { cancel(); return; }
      submitting = true;
      return async ({ result, update }) => {
        let guardCleared = false;
        try {
        if (result.type === 'success') {
          toast.success('Dados da viatura guardados. A publicação no site é independente.');
          if (redirectOnSuccess) {
            const id =
              result.data && typeof result.data === 'object' && 'id' in result.data
                ? (result.data as { id: string }).id
                : undefined;
            if (id) {
              submitting = false;
              await tick();
              markFormSaved(formElement);
              guardCleared = true;
              await goto(crmPath(`/viaturas/${id}`));
              return;
            }
          }
        } else if (result.type === 'failure') {
          showFormErrors(formElement, result.data);

          const err = (result.data as { error?: string } | undefined)?.error ?? 'Falha ao guardar.';
          toast.error(err);
        }
        if (result.type === 'redirect') { submitting = false; await tick(); markFormSaved(formElement); guardCleared = true; }
        await update({ reset: false, invalidateAll: result.type === 'success' });
        } finally {
          submitting = false;
          await tick();
          if (!guardCleared && (result.type === 'success' || result.type === 'redirect')) markFormSaved(formElement);
        }
      };
    }}
    class="space-y-6"
  >
    <fieldset class="contents" data-save-lock disabled={submitting || disabled}>
    <div>
      <h2 class="font-display font-semibold text-[18px]">Identificação da viatura</h2>
      <p class="text-[12px] text-[var(--color-text-muted)] mt-1">
        Dados internos do stock. A publicação no site é configurada separadamente.
      </p>
    </div>
    <!-- Row 1: identification -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Marca</span>
        <input
          name="brand"
          type="text"
          required
          value={initial.brand ?? ''}
          placeholder="Dacia"
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Modelo</span>
        <input
          name="model"
          type="text"
          required
          value={initial.model ?? ''}
          placeholder="Jogger Extreme"
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Ano</span>
        <input
          name="year"
          type="number"
          min="1950"
          max={new Date().getFullYear() + 1}
          required
          value={initial.year ?? ''}
          placeholder={String(new Date().getFullYear())}
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
    </div>

    <!-- Row 2: VIN + Matrícula -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>VIN</span>
        <input
          name="vin"
          type="text"
          required
          maxlength="17"
          minlength="17"
          value={initial.vin ?? ''}
          placeholder="WAUZZZ8K9CA000000"
          class="{inputClass()} font-mono tracking-wider uppercase"
          style="border-radius: var(--radius-btn); text-transform: uppercase;"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()} title="Matrícula portuguesa">
          Matrícula
          <span
            class="text-[var(--color-text-faint)] normal-case tracking-normal text-[10.5px] ml-1"
          >
            · opcional
          </span>
        </span>
        <input
          name="licensePlate"
          type="text"
          maxlength="8"
          autocomplete="off"
          spellcheck="false"
          value={licensePlateInput}
          oninput={onPlateInput}
          placeholder="AA-00-AA"
          class="{inputClass()} font-mono tracking-[0.18em] uppercase"
          style="border-radius: var(--radius-btn); text-transform: uppercase;"
        />
      </label>
    </div>

    <!-- Row 2b: fuel + status -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Combustível</span>
        <select
          name="fuel"
          required
          value={initial.fuel ?? ''}
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        >
          <option value="" disabled>Selecionar…</option>
          {#each FUELS as f (f.value)}
            <option value={f.value}>{f.label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Estado</span>
        {#if saleRecorded || initial.status === 'SOLD' || initial.status === 'DELIVERED' || initial.status === 'RETURNED'}
          <input type="hidden" name="status" value={initial.status} />
          <p class="text-[13px] text-[var(--color-text-muted)]">
            {#if initial.status === 'RETURNED'}
              Devolvida ao cliente · Ficha histórica fora do stock. Regularize uma nova aquisição
              separadamente.
            {:else}
              {initial.status === 'DELIVERED' ? 'Entregue' : 'Vendido'} · Altere a entrega ou anule a
              venda no detalhe da venda.
            {/if}
          </p>
        {:else}
          <select
            name="status"
            value={initial.status ?? 'AVAILABLE'}
            class={inputClass()}
            style="border-radius: var(--radius-btn);"
          >
            {#each STATUSES as s (s.value)}
              <option value={s.value}>{s.label}</option>
            {/each}
          </select>
        {/if}
      </label>
    </div>

    <h2 class="font-display font-semibold text-[18px]">Valores e aquisição</h2>
    <!-- Row 3: numbers -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Quilometragem</span>
        <input
          name="mileage"
          type="number"
          min="0"
          max="2000000"
          required
          value={initial.mileage ?? ''}
          placeholder="67000"
          class="{inputClass()} tabular-nums"
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Preço Compra (€)</span>
        <input
          name="purchasePrice"
          type="number"
          step="0.01"
          min="0"
          required
          value={initial.purchasePrice ?? ''}
          placeholder="14000.00"
          class="{inputClass()} tabular-nums"
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()}
          >{saleRecorded ? 'Preço registado da venda (€)' : 'Preço de venda previsto (€)'}</span
        >
        <input
          name="salePrice"
          type="number"
          step="0.01"
          min="0"
          value={initial.salePrice ?? ''}
          placeholder="17950.00"
          class="{inputClass()} tabular-nums"
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabelClass()}>Aquisição</span>
        <input
          name="acquisitionDate"
          type="date"
          required
          value={defaultAcquisitionDate}
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
    </div>

    {#if saleRecorded}
      <p class="text-[13px] text-[var(--color-text-muted)]">
        Correções dos preços de compra ou venda recalculam a venda, mantendo o tipo de comprador e a
        comissão. O preço público do website é independente.
      </p>
    {/if}

    <h2 class="font-display font-semibold text-[18px]">Notas e documentação</h2>
    <!-- Description -->
    <label class="flex flex-col">
      <span class={fieldLabelClass()}>Notas</span>
      <textarea
        name="description"
        rows="3"
        placeholder="Histórico de manutenção, extras, observações…"
        class="px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
        style="border-radius: var(--radius-btn);"
        value={initial.description ?? ''}
      ></textarea>
    </label>

    <!-- Pending docs flags -->
    <fieldset
      class="border border-[var(--color-border)] p-4"
      style="border-radius: var(--radius-card);"
    >
      <legend
        class="px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-faint)]"
      >
        Documentos pendentes
      </legend>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
        {#each [{ key: 'financing', label: 'Financiamento' }, { key: 'imt', label: 'IMT' }, { key: 'registration', label: 'Registo' }, { key: 'docs', label: 'Documentação' }] as flag (flag.key)}
          <label class="inline-flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name={`pendingDocFlags.${flag.key}`}
              value="true"
              checked={initial.pendingDocFlags?.[
                flag.key as keyof typeof initial.pendingDocFlags
              ] ?? false}
              class="h-4 w-4 accent-[var(--color-red)]"
            />
            {flag.label}
          </label>
        {/each}
      </div>
    </fieldset>
    </fieldset>
  </form>

  <!-- Actions -->
  <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
    <div>
      {#if extraActions}
        {@render extraActions()}
      {/if}
    </div>
    {#if !unified}<div class="ml-auto flex flex-wrap items-center gap-2">
      <Button variant="ghost" href={crmPath("/viaturas")}>Cancelar</Button>
      <Button
        variant="primary"
        type="submit"
        form={formId}
        loading={submitting}
        disabled={submitting || disabled || !valid || (requireChanges && !dirty)}
      >
        {submitLabel}
      </Button>
    </div>{/if}
  </div>
  {#if requireChanges && !unified}<p class="text-xs text-[var(--color-text-muted)]" role="status">
    {dirty ? 'Dados internos por guardar. Este botão não guarda a publicação no site.' : 'Dados internos guardados · sem alterações.'}
  </p>{/if}
</div>
