<script lang="ts">
  import { crmPath } from '$lib/paths';
  import { enhance } from '$lib/auth/enhance';
  import type { CancellationReview, SaleDetailResponse } from '$lib/server/sales';
  import { formatDate, formatEUR } from '$lib/utils/format';
  import Panel from '$lib/components/common/Panel.svelte';
  import Button from '$lib/components/common/Button.svelte';

  let {
    sale,
    form,
  }: {
    sale: SaleDetailResponse;
    form?: { review?: CancellationReview; error?: string; dependencySaleId?: string } | null;
  } = $props();
  const review = $derived(form?.review);
  let reason = $state('');
  let tradeInAction = $state('');
  let purchasePrice = $state<number | undefined>(undefined);
  let busy = $state(false);
  const inputClass =
    'w-full p-3 bg-[var(--color-bg-1)] border border-[var(--color-border)] rounded text-[var(--color-text)]';
  const deliveryLabels: Record<string, string> = {
    PENDING: 'Pendente',
    SCHEDULED: 'Agendada',
    DELIVERED: 'Entregue',
  };
  const submit = () => {
    busy = true;
    return async ({
      update,
    }: {
      update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
    }) => {
      try {
        await update({ reset: false });
      } finally {
        busy = false;
      }
    };
  };
</script>

<Panel>
  <div class="p-5 space-y-4">
    {#if sale.cancelledAt}
      <h2 class="font-display text-xl">Venda anulada em {formatDate(sale.cancelledAt)}</h2>
      <p class="whitespace-pre-wrap">Motivo: {sale.cancellationReason}</p>
      {#if sale.cancellationDecision?.tradeInAction}
        <p>
          Retoma: {sale.cancellationDecision.tradeInAction === 'RETURN'
            ? 'devolvida ao cliente, fora do stock'
            : `mantida como aquisição independente por ${formatEUR(sale.cancellationDecision.independentPurchasePrice ?? '0')}`}.
        </p>
      {/if}
      <p class="text-[var(--color-text-muted)]">
        Os valores e a entrega abaixo são históricos e não contam nos registos activos. As despesas,
        fotografias, documentos e relações foram preservados. Documentos, crédito e pagamentos
        exigem regularização manual.
      </p>
      <Button href={crmPath(`/viaturas/${sale.vehicle.id}`)} variant="outline"
        >Ver viatura e estado actual</Button
      >
    {:else}
      <h2 class="font-display text-xl">Anular venda</h2>
      {#if form?.error}
        <p role="alert" class="text-[var(--color-red)]">{form.error}</p>
        {#if form.dependencySaleId}
          <a class="underline" href={crmPath(`/vendas/${form.dependencySaleId}`)}
            >Resolver a venda posterior da retoma →</a
          >
        {/if}
      {/if}
      {#if review}
        <h3 class="font-semibold">Rever efeitos antes de confirmar</h3>
        <p>
          {review.vehicle.label} · {review.vehicle.licensePlate ?? 'Sem matrícula'} → {review
            .customer.name}
        </p>
        <p>
          Venda registada: {formatEUR(review.recorded.salePrice)} · Comissão: {formatEUR(
            review.recorded.commission,
          )} · IVA registado: {formatEUR(review.recorded.vatAmount)} · Lucro registado: {formatEUR(
            review.recorded.realProfit,
          )}
        </p>
        <p>
          Entrega registada: {deliveryLabels[review.recorded.deliveryStatus] ??
            review.recorded.deliveryStatus}{review.recorded.deliveryDate
            ? ` · ${formatDate(review.recorded.deliveryDate)}`
            : ''}
        </p>
        {#if review.tradeIn}
          <p>
            Retoma: {review.tradeIn.label} · {review.tradeIn.licensePlate ?? 'Sem matrícula'} · Valor
            atribuído: {formatEUR(review.tradeIn.allowanceValue)} · Aquisição actual: {formatEUR(
              review.tradeIn.purchasePrice,
            )} · Despesas preservadas: {formatEUR(review.tradeIn.expensesTotal)}
          </p>
        {/if}
        <p class="whitespace-pre-wrap">Motivo: {review.decision.reason}</p>
        <ul class="list-disc pl-5 space-y-2">
          {#each review.effects as effect}<li>{effect}</li>{/each}
        </ul>
        <form method="POST" action="?/cancelSale" use:enhance={submit} class="space-y-4">
          <input type="hidden" name="reason" value={review.decision.reason} />
          <input type="hidden" name="tradeInAction" value={review.decision.tradeInAction ?? ''} />
          <input
            type="hidden"
            name="independentPurchasePrice"
            value={review.decision.independentPurchasePrice ?? ''}
          />
          <input type="hidden" name="reviewToken" value={review.reviewToken} />
          <label class="flex items-start gap-2"
            ><input class="mt-1" type="checkbox" name="confirmed" value="yes" required />Confirmo a
            anulação e a decisão sobre a retoma descritas acima.</label
          >
          <div class="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" loading={busy} disabled={busy}
              >Confirmar anulação da venda</Button
            >
            <Button href={crmPath(`/vendas/${sale.id}`)} variant="outline">Rever decisão</Button>
          </div>
        </form>
      {:else}
        <p>
          {sale.vehicle.brand}
          {sale.vehicle.model} · {sale.vehicle.licensePlate ?? 'Sem matrícula'} · Cliente: {sale
            .customer.name} · Venda: {formatEUR(sale.salePrice)}
        </p>
        {#if sale.tradeIn}
          <p>
            Retoma: {sale.tradeIn.brand}
            {sale.tradeIn.model} · {sale.tradeIn.licensePlate ??
              sale.tradeIn.vin ??
              'Sem identificação'} · Valor atribuído: {formatEUR(sale.tradeIn.allowanceValue)}
          </p>
        {/if}
        <form method="POST" action="?/reviewCancellation" use:enhance={submit} class="space-y-4">
          <label class="block space-y-2"
            ><span>Motivo da anulação</span><textarea
              class={inputClass}
              name="reason"
              bind:value={reason}
              required
              minlength="3"
              maxlength="500"
              rows="3"
            ></textarea></label
          >
          {#if sale.tradeIn}
            <label class="block space-y-2"
              ><span>Destino da retoma</span>
              <select
                class={inputClass}
                name="tradeInAction"
                bind:value={tradeInAction}
                required
                onchange={() => {
                  purchasePrice = undefined;
                }}
              >
                <option value="" disabled>Escolher destino</option><option value="RETURN"
                  >Devolvida ao cliente</option
                ><option value="KEEP">Mantida no stand</option>
              </select>
            </label>
            <label class="block space-y-2"
              ><span
                >Valor confirmado da aquisição independente (€), apenas se mantida no stand</span
              ><input
                class={inputClass}
                type="number"
                name="independentPurchasePrice"
                min="0"
                max="9999999999.99"
                step="0.01"
                bind:value={purchasePrice}
                required={tradeInAction === 'KEEP'}
              /></label
            >
          {/if}
          <p class="text-[var(--color-text-muted)]">
            O próximo passo mostra os efeitos antes da confirmação. Nenhum pagamento ou reembolso é
            efectuado por este registo.
          </p>
          <Button type="submit" variant="outline" loading={busy} disabled={busy}
            >Rever efeitos da anulação</Button
          >
        </form>
      {/if}
    {/if}
  </div>
</Panel>
