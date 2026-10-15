<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { enhance } from '$app/forms';
  import { formFeedback, markFormSaved, showFormErrors } from '$lib/forms/formFeedback';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import type { Snippet } from 'svelte';
  import type { CustomerListItem } from '$lib/server/customers';
  import { isValidNIF } from '@anm/types';
  import Button from '$lib/components/common/Button.svelte';

  type Initial = {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    nif?: string;
    notes?: string;
  };

  interface Props {
    initial?: Initial;
    submitLabel?: string;
    /** Independent actions rendered outside the edit form. */
    extraActions?: Snippet;
    redirectOnSuccess?: boolean;
    action?: string;
    onsaved?: (id: string, customer?: CustomerListItem) => void | Promise<void>;
    oncancel?: () => void;
  }

  let {
    initial = {},
    submitLabel = 'Guardar',
    extraActions,
    redirectOnSuccess = true,
    action = '?/submit',
    onsaved,
    oncancel,
  }: Props = $props();

  let submitting = $state(false);
  const formId = $props.id();
  let nifValue = $state(initial.nif ?? '');
  const nifValid = $derived(nifValue.length === 0 || isValidNIF(nifValue));

  function fieldLabel() {
    return 'font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-1.5';
  }

  function inputClass(extra = '') {
    return `h-11 px-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors ${extra}`;
  }
</script>

<div class="space-y-6">
  <form
    id={formId}
    method="POST"
    {action}
    use:formFeedback
    use:enhance={({ formElement }) => {
      submitting = true;
      return async ({ result, update }) => {
        submitting = false;
        if (result.type === 'success') {
          markFormSaved(formElement);
          toast.success('Cliente guardado.');
          if (onsaved && result.data && 'id' in result.data) {
            await onsaved(
              result.data.id as string,
              result.data.customer as CustomerListItem | undefined,
            );
            return;
          }
          if (redirectOnSuccess) {
            const id =
              result.data && typeof result.data === 'object' && 'id' in result.data
                ? (result.data as { id: string }).id
                : undefined;
            if (id) {
              await goto(crmPath(`/clientes/${id}`));
              return;
            }
          }
        } else if (result.type === 'failure') {
          showFormErrors(formElement, result.data);

          toast.error(
            (result.data as { error?: string } | undefined)?.error ?? 'Falha ao guardar.',
          );
        }
        if (result.type === 'redirect') markFormSaved(formElement);
        await update({ reset: false, invalidateAll: result.type === 'success' });
      };
    }}
    class="space-y-6"
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="flex flex-col md:col-span-2">
        <span class={fieldLabel()}>Nome completo</span>
        <input
          name="name"
          type="text"
          required
          minlength="2"
          maxlength="120"
          value={initial.name ?? ''}
          placeholder="João Silva"
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabel()}>NIF</span>
        <input
          name="nif"
          type="text"
          inputmode="numeric"
          maxlength="9"
          required
          bind:value={nifValue}
          placeholder="923123827"
          class="{inputClass('font-mono tabular-nums')} {nifValid
            ? ''
            : '!border-[var(--color-red)] !ring-[color-mix(in_oklab,var(--color-red)_25%,transparent)] !ring-2'}"
          style="border-radius: var(--radius-btn);"
        />
        {#if !nifValid}
          <span
            class="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-red)]"
          >
            NIF deve conter apenas dígitos
          </span>
        {/if}
      </label>
      <label class="flex flex-col">
        <span class={fieldLabel()}>Telefone</span>
        <input
          name="phone"
          type="tel"
          inputmode="numeric"
          required
          maxlength="9"
          pattern={'[0-9]{9}'}
          value={initial.phone ?? ''}
          placeholder="938272382"
          class={inputClass('font-mono tabular-nums')}
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabel()}>Email</span>
        <input
          name="email"
          type="email"
          value={initial.email ?? ''}
          placeholder="joao@exemplo.pt"
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
      <label class="flex flex-col">
        <span class={fieldLabel()}>Morada</span>
        <input
          name="address"
          type="text"
          maxlength="240"
          value={initial.address ?? ''}
          placeholder="Rua das Flores 123, 4500-000 Porto"
          class={inputClass()}
          style="border-radius: var(--radius-btn);"
        />
      </label>
    </div>

    <label class="flex flex-col">
      <span class={fieldLabel()}>Notas</span>
      <textarea
        name="notes"
        rows="5"
        maxlength="4000"
        placeholder="Histórico de contactos, preferências, observações…"
        class="px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
        style="border-radius: var(--radius-btn);"
        value={initial.notes ?? ''}
      ></textarea>
    </label>
  </form>

  <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
    <div>
      {#if extraActions}{@render extraActions()}{/if}
    </div>
    <div class="ml-auto flex flex-wrap items-center gap-2">
      {#if oncancel}<Button variant="ghost" onclick={oncancel}>Cancelar</Button>{:else}<Button
          variant="ghost"
          href={crmPath("/clientes")}>Cancelar</Button
        >{/if}
      <Button
        variant="primary"
        type="submit"
        form={formId}
        loading={submitting}
        disabled={submitting || !nifValid}
      >
        {submitLabel}
      </Button>
    </div>
  </div>
</div>
