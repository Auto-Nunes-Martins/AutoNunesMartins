<script lang="ts">
  import { tradeInCreateSchema, licensePlatePtSchema } from '@anm/types';
  import { sessionFetch } from '$lib/auth/session';
  import DateInput from '$lib/components/common/DateInput.svelte';
  import { crmPath } from '$lib/paths';
  import { tick, untrack } from 'svelte';
  import { enhance } from '$lib/auth/enhance';
  import {
    formFeedback,
    isFormDirty,
    markFormSaved,
    showFormErrors,
  } from '$lib/forms/formFeedback';
  import CustomerForm from '$lib/components/customer/CustomerForm.svelte';
  import type { CustomerListItem } from '$lib/server/customers';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { ArrowRightLeft, Calendar, Search, Tag, User as UserIcon } from 'lucide-svelte';
  import ItalicHero from '$lib/components/brand/ItalicHero.svelte';
  import BrandPlus from '$lib/components/brand/icons/BrandPlus.svelte';
  import Panel from '$lib/components/common/Panel.svelte';
  import PanelHeader from '$lib/components/brand/PanelHeader.svelte';
  import Button from '$lib/components/common/Button.svelte';
  import { formatEUR } from '$lib/utils/format';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  const v = $derived(data.vehicle);
  const today = new Date().toISOString().slice(0, 10);

  let customerDialog: HTMLDialogElement;
  let customerDialogOpen = $state(false);
  async function openCustomer() {
    customerDialogOpen = true;
    await tick();
    customerDialog.showModal();
  }
  function closeCustomer(event?: Event) {
    const form = customerDialog.querySelector('form');
    if (form && isFormDirty(form) && !window.confirm('Descartar os dados deste cliente?')) {
      event?.preventDefault();
      return;
    }
    customerDialog.close();
  }
  let createdCustomers = $state<CustomerListItem[]>([]);
  const customers = $derived([
    ...createdCustomers,
    ...data.customers.filter((c) => !createdCustomers.some((n) => n.id === c.id)),
  ]);
  async function customerCreated(id: string, customer?: CustomerListItem) {
    if (customer) createdCustomers = [...createdCustomers, customer];
    customerId = id;
    customerSearch = '';
    customerDialog.close();
    saleForm?.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    saleForm?.querySelector<HTMLInputElement>('[name="salePrice"]')?.focus({ preventScroll: true });
  }
  let saleForm: HTMLFormElement;
  let customerSearch = $state('');
  let customerId = $state('');
  let selectedFromSearch = $state<CustomerListItem | null>(null);
  let remoteCustomers = $state<CustomerListItem[] | null>(null);
  let remoteCustomerTotal = $state(0);
  let searchingCustomers = $state(false);
  let customerSearchError = $state('');
  $effect(() => {
    const q = customerSearch.trim();
    remoteCustomers = null;
    customerSearchError = '';
    searchingCustomers = false;
    if (!q || customerId) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      searchingCustomers = true;
      try {
        const response = await sessionFetch(
          crmPath(`/clientes/pesquisar?q=${encodeURIComponent(q)}`),
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error('Pesquisa indisponível');
        const result = (await response.json()) as { items: CustomerListItem[]; total: number };
        if (controller.signal.aborted) return;
        remoteCustomers = result.items;
        remoteCustomerTotal = result.total;
      } catch {
        if (!controller.signal.aborted)
          customerSearchError = 'Não foi possível pesquisar todos os clientes. Tente novamente.';
      } finally {
        if (!controller.signal.aborted) searchingCustomers = false;
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  });
  // Read initial salePrice from data directly (not via $derived `v`) to avoid
  // Svelte 5's state_referenced_locally warning. We only need a default.
  let salePriceInput = $state(untrack(() => data.vehicle.salePrice ?? ''));
  // Optional financing-referral commission. Net amount the dealer actually
  // pockets from the credit institution — added on top of the vehicle's
  // net margin in the live preview and persisted on the Sale row.
  let commissionInput = $state('');
  // Tax regime selector. PARTICULAR → 23/123 margin scheme (IVA leaves the
  // dealer's pocket). COMERCIANTE → B2B sale without IVA discriminated by
  // the seller, so the full margin lands in Lucro Real.
  let buyerType = $state<'PARTICULAR' | 'COMERCIANTE'>('PARTICULAR');
  // ─── Retoma (trade-in) ───────────────────────────────────────────────
  // Off by default — most sales are pure cash. When the dealer toggles it
  // on, the intake form appears and a TradeIn row is persisted alongside
  // the Sale. Its acquisition cost does not change this sale's margin.
  let hasTradeIn = $state(false);
  let tradeInBrand = $state('');
  let tradeInModel = $state('');
  let tradeInYear = $state('');
  let tradeInFuel = $state<
    '' | 'GASOLINE' | 'DIESEL' | 'HYBRID' | 'PLUGIN_HYBRID' | 'ELECTRIC' | 'LPG'
  >('');
  let tradeInMileage = $state('');
  let tradeInPlate = $state('');
  let tradeInVin = $state('');
  let tradeInAllowance = $state('');
  // STOCK creates a draft with the same identification rules as the main form.
  // SCRAP sends the car for dismantling and never adds it to inventory.
  let tradeInDisposition = $state<'STOCK' | 'SCRAP'>('STOCK');
  let tradeInNotes = $state('');
  let tradeInDocs = $state({ financing: false, imt: false, registration: false, docs: false });
  // Field-level errors returned by the backend.
  // Set when the server responds with 409 and a field, such as a duplicate
  // VIN. Clear on input in the corresponding field so the warning
  // disappears as soon as the user starts correcting the value.
  let tradeInVinError = $state<string | null>(null);
  let tradeInPlateError = $state<string | null>(null);
  let submitting = $state(false);

  const matchingCustomers = $derived.by(() => {
    const q = customerSearch.trim().toLowerCase();
    if (remoteCustomers !== null && q) return remoteCustomers;
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nif.includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  });
  const filteredCustomers = $derived(matchingCustomers.slice(0, 50));

  const selectedCustomer = $derived(
    customerId
      ? (customers.find((c) => c.id === customerId) ??
          (selectedFromSearch?.id === customerId ? selectedFromSearch : null))
      : null,
  );

  // Live margin VAT preview (mirrors backend computation exactly, including
  // the manual commission fold-in so the previewed "Lucro Real" matches the
  // value that will be persisted on submit).
  const figures = $derived.by(() => {
    const price = Number(salePriceInput);
    const purchase = Number(v.purchasePrice);
    const expensesTotal = Number(v.expensesTotal);
    // Commission may be blank, "0", or a positive number. Treat anything
    // not parseable as 0 so the preview never reads NaN.
    const commissionNum = Number(commissionInput);
    const commission = Number.isFinite(commissionNum) && commissionNum > 0 ? commissionNum : 0;

    if (!Number.isFinite(price) || price <= 0) {
      return {
        margin: '0.00',
        vat: '0.00',
        commission: commission.toFixed(2),
        profit: commission.toFixed(2),
      };
    }
    // A trade-in does NOT affect margin or VAT: it is a separate purchase
    // creating a stock vehicle with cost equal to the allowance. Only the
    // dealer vehicle sale margin matters here (see backend computeSaleFigures).
    const margin = price - purchase - expensesTotal;
    if (margin <= 0 || buyerType === 'COMERCIANTE') {
      const profit = margin + commission;
      return {
        margin: margin.toFixed(2),
        vat: '0.00',
        commission: commission.toFixed(2),
        profit: profit.toFixed(2),
      };
    }
    const vat = (margin * 23) / 123;
    const profit = margin - vat + commission;
    return {
      margin: margin.toFixed(2),
      vat: vat.toFixed(2),
      commission: commission.toFixed(2),
      profit: profit.toFixed(2),
    };
  });

  // Client-side guard: refuse submit when the trade-in is enabled but its
  // mandatory fields aren't filled. The allowance is NOT capped by the
  // sale price anymore (the trade-in is a parallel deal — it can perfectly
  // well be worth more than the sold car, e.g. a downgrade trade).
  function validateTradeIn(): string | null {
    if (!hasTradeIn) return null;
    const parsed = tradeInCreateSchema.safeParse({
      brand: tradeInBrand,
      model: tradeInModel,
      year: tradeInYear,
      fuel: tradeInFuel,
      mileage: tradeInMileage,
      licensePlate: tradeInPlate,
      vin: tradeInVin,
      allowanceValue: tradeInAllowance,
      disposition: tradeInDisposition,
      notes: tradeInNotes,
    });
    if (!parsed.success) {
      showFormErrors(saleForm, {
        error: 'Reveja os dados da retoma.',
        issues: parsed.error.issues.map((issue) => ({
          ...issue,
          path: ['tradeIn', ...issue.path],
        })),
      });
      return parsed.error.issues[0]?.message ?? 'Reveja os dados da retoma.';
    }
    return null;
  }

  async function pickCustomer(id: string) {
    selectedFromSearch = filteredCustomers.find((customer) => customer.id === id) ?? null;
    customerId = id;
    customerSearch = '';
    await tick();
    saleForm?.querySelector<HTMLInputElement>('[name="salePrice"]')?.focus({ preventScroll: true });
  }

  async function clearCustomer() {
    customerId = '';
    selectedFromSearch = null;
    await tick();
    saleForm
      ?.querySelector<HTMLInputElement>('[data-error-field="customerId"]')
      ?.focus({ preventScroll: true });
  }
  function navigateRadio<T extends string>(
    event: KeyboardEvent,
    current: T,
    choices: T[],
    select: (value: T) => void,
  ) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = choices.indexOf(current);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? choices.length - 1
          : (index +
              (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) +
              choices.length) %
            choices.length;
    const group = event.currentTarget as HTMLElement;
    select(choices[next]!);
    void tick().then(() =>
      group.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')?.focus(),
    );
  }
</script>

<svelte:head>
  <title>Registar Venda · {v.brand} {v.model}</title>
</svelte:head>

<section class="sale-workflow pt-8 pb-12 space-y-6">
  <div>
    <ItalicHero text="Registar venda" size="lg" />
    <p
      class="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span class="text-[var(--color-red)]">●</span>
      <span>{v.brand} {v.model}</span>
      <span class="text-[var(--color-text-faint)]">·</span>
      <span>{v.year}</span>
      <span class="text-[var(--color-text-faint)]">·</span>
      <span>{v.licensePlate ?? v.vin}</span>
    </p>
  </div>

  <form
    method="POST"
    action="?/submit"
    bind:this={saleForm}
    use:formFeedback
    use:enhance={({ cancel, formElement }) => {
      if (submitting) {
        cancel();
        return;
      }
      if (!customerId) {
        toast.error('Seleciona um cliente.');
        cancel();
        return;
      }
      const tradeInError = validateTradeIn();
      if (tradeInError) {
        toast.error(tradeInError);
        cancel();
        return;
      }
      submitting = true;
      return async ({ result, update }) => {
        try {
          if (result.type === 'success') {
            markFormSaved(formElement);
            toast.success('Venda registada.');
            await goto(crmPath(`/viaturas/${v.id}`), { invalidateAll: true });
            return;
          } else if (result.type === 'failure') {
            // Preserve local fields when applying a failure; do not reset the form.
            const data = result.data as import('$lib/forms/formFeedback').FormFailure | undefined;
            showFormErrors(formElement, data);
            toast.error(data?.error ?? 'Falha ao registar.');
            // Mark an input with an inline error when the backend identifies
            // the conflicting field, such as a duplicate VIN or license plate.
            if (data?.field === 'tradeIn.vin') {
              tradeInVinError = data.error ?? 'VIN duplicado.';
            }
            if (data?.field === 'tradeIn.licensePlate') {
              tradeInPlateError = data.error ?? 'Matrícula duplicada.';
            }
          }
          await update({ reset: false, invalidateAll: false });
        } finally {
          submitting = false;
        }
      };
    }}
    class="grid grid-cols-1 lg:grid-cols-12 gap-6"
  >
    <input type="hidden" name="vehicleId" value={v.id} />
    <input type="hidden" name="customerId" value={customerId} />
    <input type="hidden" name="buyerType" value={buyerType} />
    <!-- Trade-in toggle + disposition travel as hidden inputs so the action
         can branch on a single boolean string. When `hasTradeIn === 'true'`
         the action collects the remaining `tradeIn.*` named fields. -->
    <input type="hidden" name="hasTradeIn" value={hasTradeIn ? 'true' : 'false'} />
    <input type="hidden" name="tradeIn.disposition" value={tradeInDisposition} />

    <!-- LEFT: customer + sale fields -->
    <div class="sale-fields crm-form-layout lg:col-span-8 space-y-6">
      <Panel>
        <PanelHeader icon={UserIcon} title="Cliente">
          {#snippet actions()}
            <Button variant="primary" size="sm" onclick={openCustomer}>
              <BrandPlus class="h-4 w-4" />
              Novo cliente
            </Button>
          {/snippet}
        </PanelHeader>
        <div class="p-5 space-y-3">
          {#if selectedCustomer}
            <div
              class="flex items-center justify-between gap-4 p-3 border border-[color-mix(in_oklab,var(--color-red)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-red)_5%,transparent)]"
              style="border-radius: var(--radius-btn);"
            >
              <div>
                <div class="font-display font-semibold text-[16px]">{selectedCustomer.name}</div>
                <div
                  class="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
                >
                  NIF {selectedCustomer.nif} <span class="text-[var(--color-text-faint)]">·</span>
                  {selectedCustomer.phone}
                </div>
              </div>
              <button
                type="button"
                onclick={clearCustomer}
                class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] hover:text-[var(--color-red)] transition-colors"
              >
                Trocar
              </button>
            </div>
          {:else}
            <div
              class="relative flex items-center h-11 px-3 border border-[var(--color-border)] bg-[var(--color-bg-1)] focus-within:border-[var(--color-red)] transition-colors"
              style="border-radius: var(--radius-btn);"
            >
              <Search class="h-4 w-4 text-[var(--color-text-faint)]" />
              <input
                type="search"
                maxlength="120"
                aria-label="Pesquisar cliente por nome, NIF, telefone ou email"
                data-error-field="customerId"
                placeholder="Pesquisar por nome, NIF ou telefone…"
                bind:value={customerSearch}
                class="min-w-0 flex-1 bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--color-text-faint)]"
              />
            </div>

            <div
              class="max-h-48 overflow-y-auto border border-[var(--color-border)] bg-[var(--color-bg-1)]"
              style="border-radius: var(--radius-btn);"
            >
              {#if searchingCustomers && filteredCustomers.length === 0}
                <p class="p-4 text-sm text-[var(--color-text-muted)]" role="status">
                  A pesquisar clientes…
                </p>
              {:else if filteredCustomers.length === 0 && !customerSearchError}
                <div
                  class="p-4 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
                >
                  Sem resultados — <button
                    type="button"
                    class="text-[var(--color-red)] underline"
                    onclick={openCustomer}>criar cliente</button
                  >
                </div>
              {:else}
                {#each filteredCustomers as c (c.id)}
                  <button
                    type="button"
                    onclick={() => pickCustomer(c.id)}
                    class="w-full text-left flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[color-mix(in_oklab,var(--color-red)_6%,transparent)] transition-colors"
                  >
                    <div>
                      <div class="font-display font-semibold text-[14px]">{c.name}</div>
                      <div
                        class="mt-0.5 font-mono text-[10.5px] tracking-[0.04em] text-[var(--color-text-faint)]"
                      >
                        NIF {c.nif} · {c.phone}
                      </div>
                    </div>
                    <span
                      class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
                    >
                      {c._count.sales} compras
                    </span>
                  </button>
                {/each}
              {/if}
            </div>
            {#if searchingCustomers && filteredCustomers.length > 0}<p
                role="status"
                class="text-xs text-[var(--color-text-muted)]"
              >
                A pesquisar todos os clientes…
              </p>{/if}
            {#if customerSearchError}<p role="alert" class="text-xs text-[var(--color-red)]">
                {customerSearchError}
              </p>{/if}
            {#if remoteCustomers !== null && remoteCustomerTotal > filteredCustomers.length}<p
                class="text-xs text-[var(--color-text-muted)]"
              >
                A mostrar {filteredCustomers.length} correspondências. Acrescente mais informação à pesquisa.
              </p>{/if}
            {#if matchingCustomers.length > filteredCustomers.length}<p
                class="text-xs text-[var(--color-text-muted)]"
              >
                A mostrar os primeiros {filteredCustomers.length} clientes. Escreva para encontrar o cliente
                pretendido.
              </p>{/if}
          {/if}
        </div>
      </Panel>

      <Panel>
        <PanelHeader icon={Tag} title="Detalhes da venda" />
        <div class="p-5 space-y-4">
          <!-- Buyer type: private buyers use the 23/123 margin VAT scheme, paid from profit. Dealer sales are B2B with no itemized VAT, retaining the full margin as profit. The selector updates the preview immediately. -->
          <div class="flex flex-col">
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
            >
              Tipo de comprador
            </span>
            <div
              class="inline-flex h-11 p-1 border border-[var(--color-border)] bg-[var(--color-bg-1)] self-start"
              style="border-radius: var(--radius-btn);"
              role="radiogroup"
              tabindex="-1"
              aria-label="Tipo de comprador"
              onkeydown={(event) =>
                navigateRadio(
                  event,
                  buyerType,
                  ['PARTICULAR', 'COMERCIANTE'],
                  (value) => (buyerType = value),
                )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={buyerType === 'PARTICULAR'}
                tabindex={buyerType === 'PARTICULAR' ? 0 : -1}
                onclick={() => (buyerType = 'PARTICULAR')}
                class="px-4 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors {buyerType ===
                'PARTICULAR'
                  ? 'bg-[var(--color-red)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
                style="border-radius: calc(var(--radius-btn) - 2px);"
              >
                Particular
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={buyerType === 'COMERCIANTE'}
                tabindex={buyerType === 'COMERCIANTE' ? 0 : -1}
                onclick={() => (buyerType = 'COMERCIANTE')}
                class="px-4 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors {buyerType ===
                'COMERCIANTE'
                  ? 'bg-[var(--color-red)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
                style="border-radius: calc(var(--radius-btn) - 2px);"
              >
                Comerciante
              </button>
            </div>
            <span
              class="mt-1.5 font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-[0.12em] leading-relaxed"
            >
              {#if buyerType === 'PARTICULAR'}
                Regime de margem 23/123 — IVA sai do lucro.
              {:else}
                Venda B2B sem IVA — margem inteira fica como lucro real.
              {/if}
            </span>
          </div>
        </div>
        <div class="sale-detail-fields crm-field-grid px-5 pb-5">
          <label class="flex flex-col crm-field-4">
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
            >
              Preço de venda (€)
            </span>
            <input
              name="salePrice"
              type="number"
              step="0.01"
              min="0"
              required
              bind:value={salePriceInput}
              placeholder="17950.00"
              class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] tabular-nums outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
              style="border-radius: var(--radius-btn);"
            />
          </label>
          <label class="flex flex-col crm-field-4">
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
            >
              Data da venda
            </span>
            <DateInput
              name="saleDate"
              required
              value={today}
              class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
              style="border-radius: var(--radius-btn);"
            />
          </label>
          <label class="flex flex-col crm-field-4">
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
            >
              Estado da entrega
            </span>
            <select
              name="deliveryStatus"
              class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] transition-colors"
              style="border-radius: var(--radius-btn);"
              value="PENDING"
            >
              <option value="PENDING">Pendente</option>
              <option value="SCHEDULED">Agendada</option>
              <option value="DELIVERED">Entregue</option>
            </select>
          </label>
          <label class="flex flex-col crm-field-4">
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
            >
              Data da entrega (opcional)
            </span>
            <DateInput
              name="deliveryDate"
              class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
              style="border-radius: var(--radius-btn);"
            />
          </label>

          <label class="flex flex-col crm-field-8">
            <span
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5 flex items-center gap-2"
            >
              Comissão extra (€)
              <span
                class="text-[var(--color-text-faint)] normal-case tracking-normal text-[10.5px]"
              >
                · opcional
              </span>
            </span>
            <input
              name="commission"
              data-compact-amount
              type="number"
              step="0.01"
              min="0"
              bind:value={commissionInput}
              placeholder="0.00"
              title="Valor que a financeira te paga pela intermediação. Isento de IVA ao abrigo do art. 9.º, 27.º, a) do CIVA — introduz o valor líquido tal como o recebes."
              class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] tabular-nums outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
              style="border-radius: var(--radius-btn);"
            />
            <span
              class="mt-1.5 font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-[0.12em] leading-relaxed"
            >
              Valor líquido, somado ao Lucro Real.<br />
              <span class="normal-case tracking-normal text-[10.5px]">
                Isento de IVA (art. 9.º, 27.º, a) CIVA) — entra como rendimento para efeitos de IRC.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <!-- Trade-in is disabled by default and appears only when the customer provides a car as part of payment. The allowance offsets the sale price in the margin/VAT calculation. STOCK creates a Vehicle in inventory; SCRAP records the deal without adding stock. -->
      <Panel>
        <PanelHeader
          icon={ArrowRightLeft}
          title="Retoma"
          meta={hasTradeIn
            ? tradeInDisposition === 'STOCK'
              ? 'ENTRA NO STOCK'
              : 'PARA ABATE'
            : 'OPCIONAL'}
        />
        <div class="p-5 space-y-4">
          <label class="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={hasTradeIn}
              class="mt-1 h-4 w-4 accent-[var(--color-red)]"
            />
            <span class="text-[13px] leading-snug">
              <span class="font-display font-semibold">Cliente entrega carro como retoma</span>
              <span
                class="block mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] normal-case tracking-normal"
              >
                A retoma é registada como compra separada — não afeta a margem nem o IVA desta
                venda.
              </span>
            </span>
          </label>

          {#if hasTradeIn}
            <!-- Disposition picker — drives whether a Vehicle row is created. -->
            <div class="flex flex-col">
              <span
                class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
              >
                O que fazer com este carro?
              </span>
              <div
                class="inline-flex h-11 p-1 border border-[var(--color-border)] bg-[var(--color-bg-1)] self-start"
                style="border-radius: var(--radius-btn);"
                role="radiogroup"
                tabindex="-1"
                aria-label="Destino da retoma"
                onkeydown={(event) =>
                  navigateRadio(
                    event,
                    tradeInDisposition,
                    ['STOCK', 'SCRAP'],
                    (value) => (tradeInDisposition = value),
                  )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={tradeInDisposition === 'STOCK'}
                  tabindex={tradeInDisposition === 'STOCK' ? 0 : -1}
                  onclick={() => (tradeInDisposition = 'STOCK')}
                  class="px-4 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors {tradeInDisposition ===
                  'STOCK'
                    ? 'bg-[var(--color-red)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
                  style="border-radius: calc(var(--radius-btn) - 2px);"
                >
                  Pôr à venda no stand
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tradeInDisposition === 'SCRAP'}
                  tabindex={tradeInDisposition === 'SCRAP' ? 0 : -1}
                  onclick={() => (tradeInDisposition = 'SCRAP')}
                  class="px-4 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors {tradeInDisposition ===
                  'SCRAP'
                    ? 'bg-[var(--color-red)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}"
                  style="border-radius: calc(var(--radius-btn) - 2px);"
                >
                  Abate / desmanche
                </button>
              </div>
              <span
                class="mt-1.5 font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-[0.12em] leading-relaxed"
              >
                {#if tradeInDisposition === 'STOCK'}
                  Cria uma ficha em rascunho com custo igual ao valor da retoma e aquisição na data
                  da venda. Complete depois o preço de venda na ficha. Fotografias e dados do site
                  público não são necessários.
                {:else}
                  Carro vai para abate/desmanche — não entra no inventário.
                {/if}
              </span>
            </div>

            <div class="crm-field-grid">
              <label class="flex flex-col crm-field-4">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Marca
                </span>
                <input
                  name="tradeIn.brand"
                  required
                  maxlength="60"
                  type="text"
                  bind:value={tradeInBrand}
                  placeholder="Renault"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] transition-colors"
                  style="border-radius: var(--radius-btn);"
                />
              </label>
              <label class="flex flex-col crm-field-8">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Modelo
                </span>
                <input
                  name="tradeIn.model"
                  required
                  maxlength="80"
                  type="text"
                  bind:value={tradeInModel}
                  placeholder="Clio"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] transition-colors"
                  style="border-radius: var(--radius-btn);"
                />
              </label>
              <label class="flex flex-col crm-field-3">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Ano
                </span>
                <input
                  name="tradeIn.year"
                  required
                  type="number"
                  min="1950"
                  max={new Date().getFullYear() + 1}
                  bind:value={tradeInYear}
                  placeholder="2015"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] tabular-nums outline-none focus:border-[var(--color-red)] transition-colors"
                  style="border-radius: var(--radius-btn);"
                />
              </label>
              <label class="flex flex-col crm-field-3">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Combustível
                </span>
                <select
                  name="tradeIn.fuel"
                  required
                  bind:value={tradeInFuel}
                  class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] transition-colors"
                  style="border-radius: var(--radius-btn);"
                >
                  <option value="" disabled>Combustível</option>
                  <option value="GASOLINE">Gasolina</option>
                  <option value="DIESEL">Gasóleo</option>
                  <option value="HYBRID">Híbrido</option>
                  <option value="PLUGIN_HYBRID">Híbrido Plug-in</option>
                  <option value="ELECTRIC">Elétrico</option>
                  <option value="LPG">GPL</option>
                </select>
              </label>
              <label class="flex flex-col crm-field-3">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Quilometragem
                </span>
                <input
                  name="tradeIn.mileage"
                  max="2000000"
                  step="1"
                  required
                  type="number"
                  min="0"
                  bind:value={tradeInMileage}
                  placeholder="120000"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] tabular-nums outline-none focus:border-[var(--color-red)] transition-colors"
                  style="border-radius: var(--radius-btn);"
                />
              </label>
              <label class="flex flex-col crm-field-3">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Matrícula {tradeInDisposition === 'STOCK' ? '' : '(opcional)'}
                </span>
                <input
                  name="tradeIn.licensePlate"
                  required={tradeInDisposition === 'STOCK'}
                  maxlength="10"
                  onblur={() => {
                    const parsed = licensePlatePtSchema.safeParse(tradeInPlate);
                    if (parsed.success) tradeInPlate = parsed.data;
                  }}
                  type="text"
                  bind:value={tradeInPlate}
                  oninput={() => (tradeInPlateError = null)}
                  placeholder="12-AB-34"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border text-[14px] uppercase outline-none transition-colors {tradeInPlateError
                    ? 'border-[var(--color-red)] focus:border-[var(--color-red)]'
                    : 'border-[var(--color-border)] focus:border-[var(--color-red)]'}"
                  style="border-radius: var(--radius-btn);"
                />
                {#if tradeInPlateError}
                  <span
                    class="mt-1.5 font-mono text-[10px] text-[var(--color-red)] tracking-[0.06em]"
                  >
                    {tradeInPlateError}
                  </span>
                {/if}
              </label>
              <label class="flex flex-col crm-field-8">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5 flex items-center gap-2"
                >
                  VIN (opcional)
                </span>
                <input
                  name="tradeIn.vin"
                  minlength="17"
                  type="text"
                  bind:value={tradeInVin}
                  onblur={() => (tradeInVin = tradeInVin.trim().toUpperCase())}
                  oninput={() => (tradeInVinError = null)}
                  placeholder="VF1XXXXXXXXXXXXXX"
                  maxlength="17"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border text-[14px] uppercase font-mono outline-none transition-colors {tradeInVinError
                    ? 'border-[var(--color-red)] focus:border-[var(--color-red)]'
                    : 'border-[var(--color-border)] focus:border-[var(--color-red)]'}"
                  style="border-radius: var(--radius-btn);"
                />
                {#if tradeInVinError}
                  <span
                    class="mt-1.5 font-mono text-[10px] text-[var(--color-red)] tracking-[0.06em]"
                  >
                    {tradeInVinError}
                  </span>
                {/if}
              </label>
              <label class="flex flex-col crm-field-4">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Valor atribuído à retoma (€)
                </span>
                <input
                  name="tradeIn.allowanceValue"
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={tradeInAllowance}
                  placeholder="4000.00"
                  class="h-11 px-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] tabular-nums outline-none focus:border-[var(--color-red)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--color-red)_12%,transparent)] transition-colors"
                  style="border-radius: var(--radius-btn);"
                />
                <span
                  class="mt-1.5 font-mono text-[10px] text-[var(--color-text-faint)] uppercase tracking-[0.12em] leading-relaxed"
                >
                  {#if tradeInDisposition === 'STOCK'}
                    Vira o preço de compra da viatura que entra no stock.
                  {:else}
                    Custo da aquisição da retoma (só para registo — não afeta esta venda).
                  {/if}
                </span>
              </label>
              <label class="flex flex-col crm-field-full">
                <span
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1.5"
                >
                  Estado, manutenção e observações (opcional)
                </span>
                <textarea
                  name="tradeIn.notes"
                  maxlength="2000"
                  bind:value={tradeInNotes}
                  rows="2"
                  placeholder="Estado, danos visíveis, documentação em falta…"
                  class="px-3 py-2 bg-[var(--color-bg-1)] border border-[var(--color-border)] text-[14px] outline-none focus:border-[var(--color-red)] transition-colors resize-y"
                  style="border-radius: var(--radius-btn);"
                ></textarea>
              </label>
            </div>
            {#if tradeInDisposition === 'STOCK'}
              <fieldset class="space-y-3">
                <legend class="font-display font-semibold">Documentos pendentes da retoma</legend>
                <p class="text-[12px] text-[var(--color-text-muted)]">
                  Assinale apenas o que falta regularizar nesta viatura.
                </p>
                <div class="grid grid-cols-2 gap-3">
                  {#each [{ key: 'financing', label: 'Financiamento' }, { key: 'imt', label: 'IMT' }, { key: 'registration', label: 'Registo' }, { key: 'docs', label: 'Documentação' }] as flag (flag.key)}
                    <label class="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        name={'tradeIn.pendingDocFlags.' + flag.key}
                        value="true"
                        bind:checked={tradeInDocs[flag.key as keyof typeof tradeInDocs]}
                      />
                      {flag.label}
                    </label>
                  {/each}
                </div>
              </fieldset>
            {/if}
          {/if}
        </div>
      </Panel>
    </div>

    <!-- RIGHT: live profit preview and final action remain together. -->
    <div class="sale-summary lg:col-span-4">
      <Panel>
        <PanelHeader icon={Calendar} title="Resumo da venda" />
        <div class="p-5 space-y-4">
          <p class="text-[11px] text-[var(--color-text-muted)]">
            {buyerType === 'COMERCIANTE'
              ? 'Venda a comerciante · sem IVA discriminado'
              : 'Regime de margem · IVA 23/123'}
          </p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div
                class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1.5"
              >
                Compra
              </div>
              <div class="font-display text-[18px] font-bold italic tabular-nums">
                {formatEUR(v.purchasePrice)}
              </div>
            </div>
            <div>
              <div
                class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1.5"
              >
                Despesas
              </div>
              <div class="font-display text-[18px] font-bold italic tabular-nums">
                {formatEUR(v.expensesTotal)}
              </div>
            </div>
            <div>
              <div
                class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1.5"
              >
                Margem
              </div>
              <div class="font-display text-[18px] font-bold italic tabular-nums">
                {formatEUR(figures.margin)}
              </div>
            </div>
            {#if buyerType === 'PARTICULAR'}
              <div>
                <div
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1.5"
                >
                  IVA (23/123)
                </div>
                <div
                  class="font-display text-[18px] font-bold italic tabular-nums text-[var(--color-warning)]"
                >
                  {formatEUR(figures.vat)}
                </div>
              </div>
            {:else}
              <div>
                <div
                  class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1.5"
                >
                  IVA
                </div>
                <div
                  class="font-display text-[18px] font-bold italic tabular-nums text-[var(--color-text-faint)]"
                  title="Venda a comerciante — sem IVA discriminado pelo vendedor."
                >
                  —
                </div>
              </div>
            {/if}
          </div>

          <!--
            Optional commission line. Only renders when the user has entered
            a positive value — keeps the preview clean for cash sales.
          -->
          {#if Number(figures.commission) > 0}
            <div
              class="flex items-center justify-between border-t border-[var(--color-border)] pt-4 -mt-1"
            >
              <div
                class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)]"
              >
                + Comissão extra
              </div>
              <div
                class="font-display text-[18px] font-bold italic tabular-nums text-[var(--color-success)]"
              >
                {formatEUR(figures.commission)}
              </div>
            </div>
          {/if}

          <div class="border-t border-[var(--color-border)] pt-4">
            <div
              class="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-faint)] mb-1.5"
            >
              Lucro Real{buyerType === 'PARTICULAR' ? ' (após IVA' : ' (margem inteira'}{Number(
                figures.commission,
              ) > 0
                ? ' + comissão'
                : ''})
            </div>
            <div
              class="font-display text-[26px] md:text-[36px] font-extrabold italic tabular-nums tracking-tight"
              class:text-loss={Number(figures.profit) < 0}
              class:text-profit={Number(figures.profit) >= 0}
            >
              {formatEUR(figures.profit)}
            </div>
          </div>
        </div>
        <div
          class="sale-summary-actions flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] p-5"
        >
          <Button variant="ghost" href={crmPath(`/viaturas/${v.id}`)}>Cancelar</Button>
          <Button
            variant="primary"
            type="submit"
            loading={submitting}
            disabled={submitting || !customerId || !salePriceInput}
          >
            Registar venda
          </Button>
        </div>
      </Panel>
    </div>
  </form>
</section>

<dialog
  bind:this={customerDialog}
  class="customer-dialog"
  aria-labelledby="new-customer-title"
  oncancel={closeCustomer}
  onclose={() => (customerDialogOpen = false)}
>
  <h2 id="new-customer-title" class="font-display font-bold italic text-[24px]">Novo cliente</h2>
  <p class="text-[13px] text-[var(--color-text-muted)] mt-2 mb-6">
    O cliente será selecionado nesta venda. Os valores da venda mantêm-se.
  </p>
  {#if customerDialogOpen}<CustomerForm
      action="?/createCustomer"
      submitLabel="Criar e selecionar"
      redirectOnSuccess={false}
      onsaved={customerCreated}
      oncancel={closeCustomer}
    />{/if}
</dialog>

<style>
  .sale-workflow {
    max-width: 1320px;
    margin-inline: auto;
  }
  .sale-fields {
    min-width: 0;
  }
  .sale-fields :global([data-compact-amount]) {
    max-width: 240px;
  }
  .sale-summary {
    min-width: 0;
    align-self: start;
  }
  @media (min-width: 1024px) {
    .sale-summary {
      position: sticky;
      top: 88px;
    }
  }
  .customer-dialog {
    width: min(700px, calc(100vw - 32px));
    max-height: calc(100svh - 40px);
    overflow: auto;
    padding: 24px;
    margin: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card);
    background: var(--color-bg-elevated);
    color: var(--color-text);
    box-shadow: 0 20px 60px #0006;
  }
  .customer-dialog::backdrop {
    background: #0008;
    backdrop-filter: blur(2px);
  }
  .text-loss {
    color: var(--color-red);
  }
  .text-profit {
    color: var(--color-success);
  }
</style>
