<script lang="ts">
  import VehicleSpecGlyph from '../../../../../../shared/ui/VehicleSpecGlyph.svelte';
  import DateInput from '$lib/components/common/DateInput.svelte';
  import { crmPath } from '$lib/paths';
  import { enhance } from '$lib/auth/enhance';
  import {
    formFeedback,
    markFormSaved,
    showFormErrors,
    showInvalidFormFields,
  } from '$lib/forms/formFeedback';
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
    vin?: string | null;
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
    characteristics?: Snippet;
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
    onsaved?: () => void | Promise<void>;
  }

  let {
    initial = {},
    submitLabel = 'Guardar',
    extraActions,
    characteristics,
    action,
    redirectOnSuccess = true,
    saleRecorded = false,
    requireChanges = false,
    disabled = false,
    submitting = $bindable(false),
    unified = false,
    onsaveall,
    onstatechange,
    onsaved,
  }: Props = $props();

  let dirty = $state(false);
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
    return 'font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5';
  }

  function inputClass() {
    return 'h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors';
  }

  const today = new Date().toISOString().slice(0, 10);
  const defaultAcquisitionDate = $derived(initial.acquisitionDate ?? today);

  // Format only on blur: editing the middle must preserve the caret.
  const initialPlate = () => initial.licensePlate ?? '';
  let licensePlateInput = $state(initialPlate());
  function onPlateInput(e: Event) {
    licensePlateInput = (e.currentTarget as HTMLInputElement).value;
  }
  function onPlateBlur(e: FocusEvent) {
    const el = e.currentTarget as HTMLInputElement;
    const compact = el.value.replace(/[\s-]/g, '').toUpperCase();
    licensePlateInput = compact.length === 6
      ? `${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4)}`
      : el.value.toUpperCase();
    el.value = licensePlateInput;
  }

</script>

<div class="space-y-6">
  <form
    id={formId}
    data-edit-vehicle
    novalidate
    method="POST"
    action={action ?? '?/submit'}
    use:formFeedback={{
      onstatechange: (state) => {
        dirty = state.dirty;
        onstatechange?.(state);
      },
    }}
    use:enhance={({ formElement, cancel }) => {
      if (unified) {
        cancel();
        onsaveall?.();
        return;
      }
      if (submitting || disabled || (requireChanges && !dirty)) {
        cancel();
        return;
      }
      if (showInvalidFormFields(formElement)) {
        cancel();
        return;
      }
      submitting = true;
      return async ({ result, update }) => {
        let guardCleared = false;
        try {
          if (result.type === 'success' || result.type === 'redirect') await onsaved?.();
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

            const err =
              (result.data as { error?: string } | undefined)?.error ?? 'Falha ao guardar.';
            toast.error(err);
          }
          if (result.type === 'redirect') {
            submitting = false;
            await tick();
            markFormSaved(formElement);
            guardCleared = true;
          }
          await update({ reset: false, invalidateAll: result.type === 'success' });
        } finally {
          submitting = false;
          await tick();
          if (!guardCleared && (result.type === 'success' || result.type === 'redirect'))
            markFormSaved(formElement);
        }
      };
    }}
    class="crm-form-layout space-y-6"
  >
    <fieldset class="crm-form-sections" data-save-lock disabled={submitting || disabled}>
      <div>
        <h2 class="font-display font-semibold text-[18px]">Identificação da viatura</h2>
        <p class="required-note"><span aria-hidden="true">*</span> Campos obrigatórios.</p>
        <p class="text-[12px] text-[var(--color-text-muted)] mt-1">
          Dados internos do stock. A publicação no site é configurada separadamente.
        </p>
      </div>
      <div class="crm-compact-fields">
        <label class="flex flex-col" style="--field-width: 180px">
          <span class="{fieldLabelClass()} identification-label">Marca</span>
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
        <label class="flex flex-col" style="--field-width: 280px">
          <span class="{fieldLabelClass()} identification-label">Modelo</span>
          <input
            name="model"
            type="text"
            required
            value={initial.model ?? ''}
            placeholder="Jogger"
            class={inputClass()}
            style="border-radius: var(--radius-btn);"
          />
        </label>

        <label class="flex flex-col" style="--field-width: 260px">
          <span class="{fieldLabelClass()} identification-label">VIN · opcional</span>
          <input
            name="vin"
            type="text"
            maxlength="17"
            minlength="17"
            value={initial.vin ?? ''}
            placeholder="WAUZZZ8K9CA000000"
            class="{inputClass()} font-mono tracking-wider uppercase"
            style="border-radius: var(--radius-btn); text-transform: uppercase;"
          />
        </label>
        <label class="flex flex-col" style="--field-width: 180px">
          <span
            class="{fieldLabelClass()} identification-label plate-label"
            title="Matrícula portuguesa"
          >
            Matrícula
          </span>
          <input
            name="licensePlate"
            type="text"
            required
            maxlength="10"
            autocomplete="off"
            spellcheck="false"
            value={licensePlateInput}
            oninput={onPlateInput}
            onblur={onPlateBlur}
            placeholder="AA-00-AA"
            class="{inputClass()} font-mono tracking-[0.18em] uppercase"
            style="border-radius: var(--radius-btn); text-transform: uppercase;"
          />
        </label>

        <label class="flex flex-col" style="--field-width: 104px">
          <span class="{fieldLabelClass()} identification-label"
            ><VehicleSpecGlyph label="Ano" />Ano</span
          >
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
        <label class="flex flex-col" style="--field-width: 190px">
          <span class="{fieldLabelClass()} identification-label"
            ><VehicleSpecGlyph label="Combustível" />Combustível</span
          >
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
        <label class="flex flex-col" style="--field-width: 150px">
          <span class="{fieldLabelClass()} identification-label"
            ><VehicleSpecGlyph label="Quilometragem" />Quilometragem</span
          >
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
        <label class="flex flex-col" style="--field-width: 220px">
          <span class="{fieldLabelClass()} identification-label"
            ><VehicleSpecGlyph label="Estado" />Estado</span
          >
          {#if saleRecorded || initial.status === 'SOLD' || initial.status === 'DELIVERED' || initial.status === 'RETURNED'}
            <input type="hidden" name="status" value={initial.status} />
            <p class="text-[13px] text-[var(--color-text-muted)]">
              {#if initial.status === 'RETURNED'}
                Devolvida ao cliente · Ficha histórica fora do stock. Regularize uma nova aquisição
                separadamente.
              {:else}
                {initial.status === 'DELIVERED' ? 'Entregue' : 'Vendido'} · Altere a entrega ou anule
                a venda no detalhe da venda.
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
      {@render characteristics?.()}
      <h2 class="font-display font-semibold text-[18px]">Valores e aquisição</h2>
      <div class="crm-compact-fields">
        <label class="flex flex-col" style="--field-width: 170px">
          <span class={fieldLabelClass()}>Preço de compra (€)</span>
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
        <label class="flex flex-col" style="--field-width: 240px">
          <span class={fieldLabelClass()}
            >{saleRecorded ? 'Preço registado da venda (€)' : 'Preço de venda (PVP) (€)'}</span
          >
          <input
            name="salePrice"
            required
            type="number"
            step="0.01"
            min="0"
            value={initial.salePrice ?? ''}
            placeholder="17950.00"
            class="{inputClass()} tabular-nums"
            style="border-radius: var(--radius-btn);"
          />
        </label>
        <label class="flex flex-col" style="--field-width: 170px">
          <span class={fieldLabelClass()}>Aquisição</span>
          <DateInput
            name="acquisitionDate"
            required
            value={defaultAcquisitionDate}
            class={inputClass()}
            style="border-radius: var(--radius-btn);"
          />
        </label>
      </div>

      {#if saleRecorded}
        <p class="text-[13px] text-[var(--color-text-muted)]">
          Correções dos preços de compra ou venda recalculam a venda, mantendo o tipo de comprador e
          a comissão. O preço público do website é independente.
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

      <fieldset class="document-checklist">
        <legend>Documentos pendentes</legend>
        <p>Assinale apenas o que falta regularizar nesta viatura.</p>
        <div class="document-options">
          {#each [{ key: 'financing', label: 'Financiamento' }, { key: 'imt', label: 'IMT' }, { key: 'registration', label: 'Registo' }, { key: 'docs', label: 'Documentação' }] as flag (flag.key)}
            <label class="document-option">
              <input
                type="checkbox"
                name={'pendingDocFlags.' + flag.key}
                value="true"
                checked={initial.pendingDocFlags?.[
                  flag.key as keyof typeof initial.pendingDocFlags
                ] ?? false}
              />
              <span class="document-copy"
                ><strong>{flag.label}</strong><span class="document-clear">Sem pendência</span><span
                  class="document-pending">Por regularizar</span
                ></span
              >
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
        <Button variant="ghost" href={crmPath('/viaturas')}>Cancelar</Button>
        <Button
          variant="primary"
          type="submit"
          form={formId}
          loading={submitting}
          disabled={submitting || disabled || (requireChanges && !dirty)}
        >
          {submitLabel}
        </Button>
      </div>{/if}
  </div>
  {#if requireChanges && !unified}<p class="text-xs text-[var(--color-text-muted)]" role="status">
      {dirty
        ? 'Dados internos por guardar. Este botão não guarda a publicação no site.'
        : 'Dados internos guardados · sem alterações.'}
    </p>{/if}
</div>

<style>
  label:has(input[required], select[required], textarea[required]) > span:first-child::after {
    content: ' *';
    color: var(--color-red);
    font-weight: 700;
  }
  .required-note {
    font-size: 12px;
    margin-top: 8px;
    color: var(--color-text-muted);
  }
  .required-note span {
    color: var(--color-red);
    font-weight: 700;
  }
  .identification-label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 20px;
  }
  .plate-label {
    white-space: nowrap;
    gap: 6px;
  }
  .document-checklist {
    border: 0;
    border-top: 1px solid var(--color-border);
    padding: 18px 0 0;
    margin: 0;
    min-width: 0;
  }
  .document-checklist legend {
    font-size: 15px;
    font-weight: 600;
    padding-right: 12px;
  }
  .document-checklist > p {
    font-size: 12px;
    color: var(--color-text-muted);
    margin: 0 0 12px;
  }
  .document-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: 10px;
  }
  .document-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-btn);
    background: var(--color-bg-0);
    cursor: pointer;
    transition:
      border-color 140ms,
      background-color 140ms;
  }
  .document-option:hover {
    border-color: var(--color-border-strong);
    background: var(--color-bg-2);
  }
  .document-option:has(input:checked) {
    border-color: color-mix(in oklab, var(--color-red) 45%, var(--color-border));
  }
  .document-option:has(input:focus-visible) {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  .document-option input {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    accent-color: var(--color-red);
  }
  .document-copy {
    display: grid;
    gap: 4px;
  }
  .document-copy strong {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
  }
  .document-copy > span {
    font-size: 11px;
    line-height: 1.4;
    color: var(--color-text-muted);
  }
  .document-pending {
    display: none;
  }
  .document-option:has(input:checked) .document-clear {
    display: none;
  }
  .document-option:has(input:checked) .document-pending {
    display: block;
    color: var(--color-red);
  }
</style>
