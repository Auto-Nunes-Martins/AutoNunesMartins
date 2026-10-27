<script lang="ts">
  import { untrack } from 'svelte';
  import { enhance } from '$lib/auth/enhance';
  import { crmPath } from '$lib/paths';
  import { toast } from 'svelte-sonner';
  import type {
    CancellationReview,
    ResolutionContext,
    SaleDetailResponse,
  } from '$lib/server/sales';
  import { formatDate, formatEUR } from '$lib/utils/format';
  import Button from '$lib/components/common/Button.svelte';

  let {
    sale,
    context,
    form,
  }: {
    sale: SaleDetailResponse;
    context?: ResolutionContext;
    form?: { review?: CancellationReview; error?: string; dependencySaleId?: string } | null;
  } = $props();
  let operation = $state<'CANCEL' | 'DELETE'>('CANCEL');
  let editingCancelled = $state(false);
  let reason = $state('');
  let tradeInAction = $state(untrack(() => sale.cancellationDecision?.tradeInAction ?? ''));
  let purchasePrice = $state(
    untrack(
      () =>
        sale.cancellationDecision?.independentPurchasePrice ??
        context?.tradeIn?.purchasePrice ??
        '',
    ),
  );
  let acquisitionDate = $state(untrack(() => context?.tradeIn?.acquisitionDate ?? ''));
  let busy = $state(false);
  let hideReview = $state(false);
  const review = $derived(hideReview ? null : form?.review);
  const info = $derived(context);
  const laterSale = $derived(!!info?.tradeIn?.hasLaterSale);
  const deleteBlocked = $derived(!info || !!info.deletionBlockers.length);
  const submit = () => {
    busy = true;
    hideReview = false;
    return async ({
      result,
      update,
    }: {
      result: { type: string };
      update: (options?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
    }) => {
      try {
        if (result.type === 'redirect')
          toast.success(
            operation === 'DELETE'
              ? 'Registo errado eliminado. Histórico preservado.'
              : 'Venda anulada.',
          );
        await update({ reset: false });
      } finally {
        busy = false;
      }
    };
  };
  function chooseOperation(value: 'CANCEL' | 'DELETE') {
    operation = value;
    if (value !== 'DELETE' && tradeInAction === 'DELETE') tradeInAction = '';
  }
</script>

<section class="resolution" id="resolver-venda" aria-label="Anular ou corrigir venda">
  <header>
    <span class="eyebrow">GESTÃO DA VENDA</span>
    <h2>{sale.cancelledAt ? 'Venda anulada' : 'Anular ou corrigir esta venda'}</h2>
    <p>
      {sale.cancelledAt
        ? `Anulada em ${formatDate(sale.cancelledAt)}. Motivo: ${sale.cancellationReason}`
        : 'Escolha o que aconteceu. Antes de confirmar, verá o destino das viaturas e os registos que ficam guardados.'}
    </p>
  </header>

  {#if sale.cancelledAt && !editingCancelled}
    <div class="notice">
      A venda deixou de contar nos indicadores. A ficha, despesas e histórico das viaturas foram
      preservados.
      {#if sale.cancellationDecision?.tradeInAction === 'KEEP'}
        A viatura foi mantida como compra normal por {formatEUR(
          sale.cancellationDecision.independentPurchasePrice ?? '0',
        )}.
      {:else if sale.cancellationDecision?.tradeInAction === 'RETURN'}
        A retoma foi devolvida ao cliente e está fora do stock.{/if}
    </div>
    <div class="actions">
      <Button variant="outline" href={crmPath(`/viaturas/${sale.vehicle.id}`)}>Ver viatura</Button>
      <Button
        variant="danger"
        disabled={deleteBlocked}
        onclick={() => {
          operation = 'DELETE';
          editingCancelled = true;
        }}>Eliminar registo criado por engano</Button
      >
    </div>
    {#if deleteBlocked}<p class="muted">
        {info?.deletionBlockers[0] ??
          'Não foi possível verificar os registos associados. Atualize a página.'}
      </p>{/if}
  {:else}
    {#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
    {#if review}
      <div class="review-title">
        <span class="step">2</span>
        <div>
          <h3>Confirme o que vai acontecer</h3>
          <p>
            {review.vehicle.label} · {review.vehicle.licensePlate ?? 'Sem matrícula'} · {review
              .customer.name}
          </p>
        </div>
      </div>
      <div class="destinations">
        <article>
          <span class="eyebrow">VIATURA ORIGINAL</span>
          <h4>{review.vehicle.label}</h4>
          <p>{sale.cancelledAt ? 'Mantém a situação atual' : 'Volta a Disponível'}</p>
          <small>Ficha e despesas preservadas. Sem publicação automática.</small>
        </article>
        {#if review.tradeIn}
          <article>
            <span class="eyebrow">RETOMA</span>
            <h4>{review.tradeIn.label}</h4>
            <p>
              {review.decision.tradeInAction === 'KEEP'
                ? 'Compra normal no stock'
                : review.decision.tradeInAction === 'RETURN'
                  ? 'Devolvida ao cliente'
                  : 'Ficha errada eliminada'}
            </p>
            {#if review.decision.tradeInAction === 'KEEP'}<strong
                >{formatEUR(review.tradeIn.nextPurchasePrice)}</strong
              ><small
                >Aquisição em {formatDate(review.tradeIn.nextAcquisitionDate)}. {laterSale
                  ? 'A venda e a entrega seguintes mantêm-se.'
                  : 'O estado atual da ficha mantém-se.'}</small
              >
            {:else if review.decision.tradeInAction === 'RETURN'}<small
                >Fora do stock e do site. Despesas e histórico preservados.</small
              >
            {:else}<small
                >Sem despesas, vendas ou alterações posteriores. Só esta ficha será eliminada.</small
              >{/if}
          </article>
        {/if}
      </div>
      {#if review.affectedSale}
        <div class="notice">
          <h4>A venda seguinte de {review.tradeIn?.label} mantém-se</h4>
          <p>O custo de aquisição confirmado atualiza apenas os resultados dessa venda.</p>
          <div class="figures">
            <span
              >Lucro: {formatEUR(review.affectedSale.beforeProfit)} →
              <strong>{formatEUR(review.affectedSale.afterProfit)}</strong></span
            ><span
              >IVA: {formatEUR(review.affectedSale.beforeVat)} →
              <strong>{formatEUR(review.affectedSale.afterVat)}</strong></span
            >
          </div>
          <p>
            Preços, comissões e entregas mantêm-se. Os valores de entrada das retomas seguintes não
            mudam.
          </p>
        </div>
      {/if}
      <div class="consequences">
        {#if review.eliminated.length}<article class="removed">
            <h4>Será eliminado</h4>
            <ul>
              {#each review.eliminated as item}<li>{item}</li>{/each}
            </ul>
          </article>{/if}
        <article>
          <h4>Fica guardado</h4>
          <ul>
            {#each review.preserved as item}<li>{item}</li>{/each}
          </ul>
        </article>
      </div>
      <p class="muted">Motivo: {review.decision.reason}</p>
      <p class="muted">
        Esta ação não faz pagamentos nem calcula reembolsos. Documentos e crédito exigem
        regularização separada.
      </p>
      <form method="POST" action="?/cancelSale" use:enhance={submit} class="confirmation">
        <input type="hidden" name="operation" value={review.decision.operation ?? 'CANCEL'} />
        <input type="hidden" name="reason" value={review.decision.reason} />
        <input type="hidden" name="tradeInAction" value={review.decision.tradeInAction ?? ''} />
        <input
          type="hidden"
          name="independentPurchasePrice"
          value={review.decision.independentPurchasePrice ?? ''}
        />
        <input
          type="hidden"
          name="independentAcquisitionDate"
          value={review.decision.independentAcquisitionDate ?? ''}
        />
        <input type="hidden" name="reviewToken" value={review.reviewToken} />
        {#if review.decision.operation === 'DELETE'}
          <label class="field"
            ><span>Escreva ELIMINAR para confirmar o registo criado por engano</span><input
              name="deletionConfirmation"
              required
              pattern="ELIMINAR"
              autocomplete="off"
              placeholder="ELIMINAR"
            /></label
          >
        {/if}
        <label class="check"
          ><input type="checkbox" name="confirmed" value="yes" required /><span
            >Confirmo o destino das viaturas e os registos eliminados ou preservados acima.</span
          ></label
        >
        <div class="actions">
          <Button
            type="submit"
            variant={review.decision.operation === 'DELETE' ? 'danger' : 'primary'}
            loading={busy}
            disabled={busy}
            >{review.decision.operation === 'DELETE'
              ? 'Eliminar registo errado'
              : 'Confirmar anulação'}</Button
          ><Button variant="outline" disabled={busy} onclick={() => (hideReview = true)}
            >Voltar às escolhas</Button
          >
        </div>
      </form>
    {:else}
      <div class="review-title">
        <span class="step">1</span>
        <div>
          <h3>O que pretende corrigir?</h3>
          <p>Apenas esta venda. As outras viaturas e vendas são preservadas.</p>
        </div>
      </div>
      <div class="choices" role="group" aria-label="Tipo de correção">
        {#if !sale.cancelledAt}<label class:selected={operation === 'CANCEL'}
            ><input
              type="radio"
              name="resolutionOperation"
              value="CANCEL"
              checked={operation === 'CANCEL'}
              onchange={() => chooseOperation('CANCEL')}
            /><strong>Anular o negócio</strong><span
              >A venda aconteceu, mas foi desfeita. Mantém-se no histórico.</span
            ></label
          >{/if}
        <label class:selected={operation === 'DELETE'} class:unavailable={deleteBlocked}
          ><input
            type="radio"
            name="resolutionOperation"
            value="DELETE"
            checked={operation === 'DELETE'}
            disabled={deleteBlocked}
            onchange={() => chooseOperation('DELETE')}
          /><strong>Corrigir um registo errado</strong><span
            >A venda foi criada por engano. Só permite eliminar sem movimentos posteriores.</span
          ></label
        >
      </div>
      {#if deleteBlocked}<p class="muted">
          {info?.deletionBlockers[0] ?? 'Atualize a página para verificar os registos associados.'}
        </p>{/if}
      <form method="POST" action="?/reviewCancellation" use:enhance={submit} class="decision-form">
        <input type="hidden" name="operation" value={operation} />
        {#if sale.tradeIn}
          <fieldset>
            <legend>Destino da retoma · {sale.tradeIn.brand} {sale.tradeIn.model}</legend>
            {#if laterSale}<div class="notice">
                Esta retoma já foi vendida. Mantenha-a como compra normal; não precisa de anular a
                venda seguinte.
              </div>{/if}
            <label class="field"
              ><span>O que acontece à retoma?</span><select
                name="tradeInAction"
                required
                bind:value={tradeInAction}
                disabled={!!sale.cancelledAt}
              >
                <option value="" disabled>Escolher destino</option>
                <option value="RETURN" disabled={laterSale}
                  >Devolver ao cliente{laterSale ? ' — já tem venda posterior' : ''}</option
                >
                <option value="KEEP">Manter como compra normal</option>
                {#if operation === 'DELETE'}<option
                    value="DELETE"
                    disabled={!info?.canDeleteTradeIn}
                    >Eliminar também a ficha criada por engano{!info?.canDeleteTradeIn
                      ? ' — já tem movimentos ou preparação'
                      : ''}</option
                  >{/if}
              </select></label
            >
            {#if sale.cancelledAt}<input
                type="hidden"
                name="tradeInAction"
                value={tradeInAction}
              />{/if}
            {#if tradeInAction === 'KEEP'}
              <div class="field-pair">
                <label class="field"
                  ><span>Valor de aquisição de {sale.tradeIn.brand} {sale.tradeIn.model} (€)</span
                  ><input
                    name="independentPurchasePrice"
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    required
                    bind:value={purchasePrice}
                    readonly={!!sale.cancelledAt}
                  /></label
                ><label class="field"
                  ><span>Data de compra normal</span><input
                    name="independentAcquisitionDate"
                    type="date"
                    required
                    bind:value={acquisitionDate}
                    readonly={!!sale.cancelledAt}
                  /></label
                >
              </div>
              <p class="muted">
                Confirme o valor desta retoma. As despesas já registadas ficam guardadas. Não
                pedimos novos valores para as viaturas seguintes.
              </p>
            {/if}
            {#if info?.tradeIn}<p class="muted">
                Despesas desta retoma: {info.tradeIn.expensesCount} registo(s) · {formatEUR(
                  info.tradeIn.expensesTotal,
                )}.
              </p>{/if}
          </fieldset>
        {/if}
        <label class="field"
          ><span
            >{operation === 'DELETE'
              ? 'Porque foi criado este registo por engano?'
              : 'Motivo da anulação'}</span
          ><textarea
            name="reason"
            required
            minlength="3"
            maxlength="500"
            rows="3"
            bind:value={reason}
            placeholder="Descreva brevemente o que aconteceu"
          ></textarea></label
        >
        <Button type="submit" variant="outline" loading={busy} disabled={busy || !info}
          >Rever efeitos antes de confirmar</Button
        >
      </form>
    {/if}
  {/if}
  {#if info?.followingVehicles.length}
    <aside class="chain">
      <span class="eyebrow">VIATURAS SEGUINTES · PRESERVADAS</span>
      <h3>O que continua válido</h3>
      <ol>
        {#each info.followingVehicles as vehicle}<li>
            <span class="chain-dot"></span>
            <div>
              <a href={crmPath(`/viaturas/${vehicle.id}`)}>{vehicle.label}</a><small
                >{vehicle.licensePlate ?? 'Sem matrícula'} · {vehicle.sold
                  ? 'Venda preservada'
                  : 'Ficha de stock preservada'}</small
              >{#if vehicle.id !== info.tradeIn?.id}<small
                  >Aquisição mantém-se: {formatEUR(vehicle.purchasePrice)}</small
                >{/if}
            </div>
          </li>{/each}
      </ol>
      <p>Não serão eliminadas estas viaturas, as suas despesas, vendas ou retomas.</p>
    </aside>
  {/if}
</section>

<style>
  .resolution {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card, 12px);
    background: var(--color-bg-2);
    padding: 28px;
    display: grid;
    gap: 24px;
    scroll-margin-top: 100px;
  }
  header {
    display: grid;
    gap: 8px;
  }
  h2,
  h3,
  h4,
  p {
    margin: 0;
  }
  h2 {
    font-family: var(--font-display, inherit);
    font-size: 24px;
    font-weight: 650;
  }
  h3 {
    font-size: 16px;
    font-weight: 600;
  }
  h4 {
    font-size: 14px;
    font-weight: 600;
  }
  p,
  small {
    font-size: 13px;
    line-height: 1.65;
    color: var(--color-text-muted);
  }
  .eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: var(--color-text-muted);
  }
  .review-title {
    display: flex;
    gap: 12px;
    align-items: start;
  }
  .step {
    border: 1px solid var(--color-border);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    font-size: 12px;
  }
  .review-title p {
    margin-top: 4px;
  }
  .choices,
  .destinations,
  .consequences,
  .field-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .choices label {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 18px;
    display: grid;
    grid-template-columns: 16px 1fr;
    gap: 8px;
    cursor: pointer;
  }
  .choices strong {
    font-size: 14px;
  }
  .choices span {
    grid-column: 2;
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-muted);
  }
  .choices label.selected {
    border-color: var(--color-red);
    background: color-mix(in srgb, var(--color-red) 4%, transparent);
  }
  .choices label.unavailable {
    opacity: 0.55;
    cursor: default;
  }
  input[type='radio'],
  input[type='checkbox'] {
    accent-color: var(--color-red);
    margin-top: 3px;
  }
  .decision-form,
  .confirmation,
  fieldset {
    display: grid;
    gap: 18px;
  }
  fieldset {
    margin: 0;
    border: 0;
    padding: 0;
  }
  legend {
    font-size: 15px;
    font-weight: 600;
    padding: 0 0 14px;
  }
  .field {
    display: grid;
    gap: 7px;
    font-size: 12px;
    font-weight: 500;
  }
  .field input,
  .field textarea,
  .field select {
    box-sizing: border-box;
    min-width: 0;
    width: 100%;
    padding: 12px;
    background: var(--color-bg-1);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 14px;
    min-height: 44px;
  }
  .field input:focus,
  .field select:focus,
  .field textarea:focus {
    outline: 2px solid var(--color-red);
    outline-offset: 2px;
  }
  .field input[readonly] {
    opacity: 0.7;
  }
  .field textarea {
    resize: vertical;
  }
  .check {
    display: flex;
    align-items: start;
    gap: 10px;
    font-size: 13px;
    line-height: 1.6;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .notice {
    padding: 16px;
    background: var(--color-bg-1);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.7;
  }
  .notice h4 {
    margin-bottom: 6px;
  }
  .figures {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 24px;
    margin: 10px 0;
  }
  .destinations article,
  .consequences article {
    border: 1px solid var(--color-border);
    padding: 18px;
    border-radius: 8px;
    display: grid;
    align-content: start;
    gap: 8px;
  }
  .destinations strong {
    font-size: 20px;
  }
  .destinations small {
    display: block;
  }
  .consequences {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .consequences ul {
    font-size: 12px;
    line-height: 1.8;
    color: var(--color-text-muted);
    padding-left: 18px;
    margin: 0;
  }
  .consequences .removed {
    border-color: color-mix(in srgb, var(--color-red) 40%, var(--color-border));
  }
  .removed h4,
  .error {
    color: var(--color-red);
  }
  .error {
    padding: 12px;
    border: 1px solid var(--color-red);
    border-radius: 6px;
  }
  .chain {
    border-top: 1px solid var(--color-border);
    padding-top: 20px;
    display: grid;
    gap: 8px;
  }
  .chain ol {
    padding: 0;
    margin: 8px 0;
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }
  .chain li {
    display: flex;
    gap: 10px;
    align-items: start;
  }
  .chain a {
    font-size: 13px;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .chain small {
    display: block;
    font-size: 11px;
  }
  .chain-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success, #5b9874);
    margin-top: 6px;
    flex-shrink: 0;
  }
  .muted {
    font-size: 12px;
  }
  @media (max-width: 640px) {
    .resolution {
      padding: 18px;
      gap: 20px;
    }
    .choices,
    .destinations,
    .field-pair {
      grid-template-columns: 1fr;
    }
    .chain ol {
      display: grid;
      gap: 16px;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr;
    }
    h2 {
      font-size: 21px;
    }
    .choices label {
      padding: 14px;
    }
  }
</style>
