<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { trapDialogTab } from '../../../../../../shared/ui/dialogFocus';
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
    open = $bindable(false),
  }: {
    sale: SaleDetailResponse;
    context?: ResolutionContext;
    form?: { review?: CancellationReview; error?: string; dependencySaleId?: string } | null;
    open?: boolean;
  } = $props();
  let operation = $state<'CANCEL' | 'DELETE'>('CANCEL');
  let step = $state<'choose' | 'destination' | 'purchase'>('choose');
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
  let note = $state('');
  let busy = $state(false);
  let hideReview = $state(false);
  let dialogEl: HTMLDialogElement | undefined = $state();
  let decisionForm: HTMLFormElement | undefined = $state();
  const uid = $props.id();
  const review = $derived(hideReview ? null : form?.review);
  const info = $derived(context);
  const laterSale = $derived(!!info?.tradeIn?.hasLaterSale);
  const deleteBlocked = $derived(!info || !!info.deletionBlockers.length);
  const reason = $derived(
    (operation === 'DELETE' ? 'Venda registada por engano' : 'Negócio desfeito') +
      (note.trim() ? `: ${note.trim()}` : ''),
  );
  const tradeLabel = $derived(
    sale.tradeIn ? `${sale.tradeIn.brand} ${sale.tradeIn.model}` : 'a viatura',
  );
  const heading = $derived(
    review
      ? 'Rever e confirmar'
      : sale.cancelledAt
        ? 'Venda já anulada'
        : step === 'destination'
          ? `O que acontece a ${tradeLabel}?`
          : step === 'purchase'
            ? 'Confirmar entrada no stock'
            : 'O que aconteceu?',
  );

  $effect(() => {
    if (!dialogEl) return;
    if (open && !dialogEl.open) {
      dialogEl.showModal();
      focusTitle();
    } else if (!open && dialogEl.open) dialogEl.close();
  });
  function focusTitle() {
    dialogEl?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }
  function closeDialog() {
    if (!busy) open = false;
  }
  async function chooseOperation(value: 'CANCEL' | 'DELETE') {
    operation = value;
    hideReview = true;
    if (value !== 'DELETE' && tradeInAction === 'DELETE') tradeInAction = '';
    if (sale.tradeIn && !sale.cancelledAt) {
      step = 'destination';
      await tick();
      focusTitle();
    } else {
      await tick();
      decisionForm?.requestSubmit();
    }
  }
  async function chooseDestination(value: 'KEEP' | 'RETURN' | 'DELETE') {
    tradeInAction = value;
    if (value === 'KEEP') {
      step = 'purchase';
      await tick();
      focusTitle();
    } else {
      await tick();
      decisionForm?.requestSubmit();
    }
  }
  async function back() {
    if (review) {
      hideReview = true;
      step = sale.tradeIn ? (tradeInAction === 'KEEP' ? 'purchase' : 'destination') : 'choose';
    } else step = step === 'purchase' ? 'destination' : 'choose';
    await tick();
    focusTitle();
  }
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
        if (result.type === 'redirect') {
          open = false;
          toast.success(operation === 'DELETE' ? 'Registo errado eliminado.' : 'Venda anulada.');
        }
        if (result.type === 'failure') hideReview = true;
        await update({ reset: false });
        await tick();
        if (open) {
          if (result.type === 'failure')
            dialogEl?.querySelector<HTMLElement>('[role="alert"]')?.focus({ preventScroll: true });
          else focusTitle();
        }
      } finally {
        busy = false;
      }
    };
  };
</script>

<dialog
  bind:this={dialogEl}
  class="sale-resolution-dialog"
  aria-labelledby={uid + '-title'}
  oncancel={(event) => {
    event.preventDefault();
    closeDialog();
  }}
  onclose={() => (open = false)}
  onkeydown={(event) => trapDialogTab(event, dialogEl)}
  onclick={(event) => {
    if (event.target === dialogEl) closeDialog();
  }}
>
  <div class="content">
    <div class="topline">
      <span class="eyebrow"
        >{sale.vehicle.brand}
        {sale.vehicle.model} · {sale.vehicle.licensePlate ?? 'Sem matrícula'}</span
      ><button
        type="button"
        class="close-dialog"
        aria-label="Fechar anulação ou correção"
        disabled={busy}
        onclick={closeDialog}>Cancelar ×</button
      >
    </div>
    <header>
      <h2 id={uid + '-title'} tabindex="-1">{heading}</h2>
      <p>
        {review
          ? 'Só será alterado o que está indicado abaixo.'
          : 'As outras viaturas e vendas são preservadas.'}
      </p>
    </header>
    {#if form?.error}<p class="error" role="alert" tabindex="-1">{form.error}</p>{/if}

    {#if review}
      <div class="summary">
        <article>
          <span class="eyebrow">ESTA VENDA</span><strong
            >{review.decision.operation === 'DELETE'
              ? 'Registo eliminado'
              : 'Venda anulada'}</strong
          >
          <p>
            {sale.cancelledAt
              ? 'A situação atual da viatura mantém-se.'
              : `${review.vehicle.label} volta a Disponível.`}
          </p>
          <small>A ficha e as despesas da viatura ficam guardadas. Sem publicação automática.</small
          >
        </article>
        {#if review.tradeIn}<article>
            <span class="eyebrow">{review.tradeIn.label}</span><strong
              >{review.decision.tradeInAction === 'KEEP'
                ? 'Fica como compra normal'
                : review.decision.tradeInAction === 'RETURN'
                  ? 'É devolvida ao cliente'
                  : 'Ficha errada eliminada'}</strong
            >
            {#if review.decision.tradeInAction === 'KEEP'}<p>
                Entrada por {formatEUR(review.tradeIn.nextPurchasePrice)} em {formatDate(
                  review.tradeIn.nextAcquisitionDate,
                )}.
              </p>
              <small
                >Sem ligação a esta venda ou ao seu cliente. {laterSale
                  ? 'A venda e a entrega seguintes mantêm-se.'
                  : 'O estado atual da ficha mantém-se.'}</small
              >
            {:else if review.decision.tradeInAction === 'RETURN'}<small
                >Fora do stock e do site. Despesas e histórico preservados.</small
              >
            {:else}<small>Só esta ficha, criada por engano e sem movimentos, será eliminada.</small
              >{/if}
          </article>{/if}
      </div>
      {#if review.eliminated.length}<div class="destructive">
          <h3>Será eliminado</h3>
          <ul>
            {#each review.eliminated as item}<li>{item}</li>{/each}
          </ul>
          <p>Esta eliminação não pode ser desfeita.</p>
        </div>{/if}
      {#if info?.followingVehicles.length}<p class="notice">
          As vendas seguintes e os valores de entrada das outras viaturas não mudam.
        </p>{/if}
      {#if review.affectedSale}<details>
          <summary>Ver impacto no resultado da venda de {review.tradeIn?.label}</summary>
          <p>
            Lucro: {formatEUR(review.affectedSale.beforeProfit)} → {formatEUR(
              review.affectedSale.afterProfit,
            )}.
          </p>
          <p>
            IVA: {formatEUR(review.affectedSale.beforeVat)} → {formatEUR(
              review.affectedSale.afterVat,
            )}.
          </p>
          <small
            >Só o novo custo de entrada desta viatura altera estes resultados. Preços, comissão e
            entrega mantêm-se.</small
          >
        </details>{/if}
      <p class="muted">
        Não faz pagamentos nem calcula reembolsos. Documentos e crédito são regularizados à parte.
      </p>
      <form method="POST" action="?/cancelSale" use:enhance={submit}>
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
        <input type="hidden" name="confirmed" value="yes" />
        {#if review.decision.operation === 'DELETE'}<input
            type="hidden"
            name="deletionConfirmation"
            value="ELIMINAR"
          />{/if}
        <div class="actions">
          <Button variant="outline" disabled={busy} onclick={back}>Voltar</Button><Button
            type="submit"
            variant={review.decision.operation === 'DELETE' ? 'danger' : 'primary'}
            loading={busy}
            disabled={busy}
            >{review.decision.operation === 'DELETE'
              ? review.decision.tradeInAction === 'DELETE'
                ? 'Eliminar venda e ficha erradas'
                : 'Eliminar esta venda'
              : 'Confirmar anulação'}</Button
          >
        </div>
      </form>
    {:else}
      <form
        bind:this={decisionForm}
        method="POST"
        action="?/reviewCancellation"
        use:enhance={submit}
      >
        <input type="hidden" name="operation" value={operation} /><input
          type="hidden"
          name="reason"
          value={reason}
        />
        {#if sale.tradeIn}<input type="hidden" name="tradeInAction" value={tradeInAction} />{/if}
        {#if sale.tradeIn && tradeInAction === 'KEEP'}<input
            type="hidden"
            name="independentPurchasePrice"
            value={purchasePrice}
          /><input type="hidden" name="independentAcquisitionDate" value={acquisitionDate} />{/if}
        {#if sale.cancelledAt}
          <div class="notice">
            Anulada em {formatDate(sale.cancelledAt)}. Motivo: {sale.cancellationReason}. As
            viaturas e despesas foram preservadas.
          </div>
          {#if !deleteBlocked}<Button
              variant="danger"
              disabled={busy}
              onclick={() => chooseOperation('DELETE')}>Eliminar registo criado por engano</Button
            >{/if}
        {:else if step === 'choose'}
          <div class="choices">
            <button type="button" disabled={busy || !info} onclick={() => chooseOperation('CANCEL')}
              ><strong>Quero desfazer o negócio</strong><span
                >A venda fica anulada no histórico.</span
              ><b aria-hidden="true">→</b></button
            >
            {#if !deleteBlocked}<button
                type="button"
                disabled={busy}
                onclick={() => chooseOperation('DELETE')}
                ><strong>Registei esta venda por engano</strong><span
                  >Remove só o registo errado. As viaturas válidas ficam guardadas.</span
                ><b aria-hidden="true">→</b></button
              >{/if}
          </div>
        {:else if step === 'destination'}
          <div class="choices">
            <button type="button" disabled={busy} onclick={() => chooseDestination('KEEP')}
              ><strong>{laterSale ? 'Manter a viatura e a venda seguinte' : 'Fica no stand'}</strong
              ><span>Passa a compra normal, sem ligação a esta venda ou cliente.</span><b
                aria-hidden="true">→</b
              ></button
            >
            {#if !laterSale}<button
                type="button"
                disabled={busy}
                onclick={() => chooseDestination('RETURN')}
                ><strong>É devolvida ao cliente</strong><span
                  >Sai do stock. A ficha e as despesas ficam guardadas.</span
                ><b aria-hidden="true">→</b></button
              >{/if}
            {#if operation === 'DELETE' && info?.canDeleteTradeIn}<button
                type="button"
                disabled={busy}
                onclick={() => chooseDestination('DELETE')}
                ><strong>A ficha da retoma também foi criada por engano</strong><span
                  >Elimina esta ficha vazia, sem despesas nem vendas.</span
                ><b aria-hidden="true">→</b></button
              >{/if}
          </div>
          {#if laterSale}<p class="notice">
              {tradeLabel} já foi vendida. A sua ficha e a venda seguinte têm de ser mantidas.
            </p>{:else if operation === 'DELETE' && !info?.canDeleteTradeIn}<p class="muted">
              A ficha de {tradeLabel} fica guardada: {info?.tradeInDeletionBlockers?.join(' ') ??
                'tem movimentos ou preparação a preservar.'}
            </p>{/if}
        {:else}
          <p>Confirme apenas o valor de entrada de <strong>{tradeLabel}</strong>.</p>
          <div class="field-pair">
            <label class="field"
              ><span>Valor de entrada (€)</span><input
                type="number"
                min="0"
                max="9999999999.99"
                step="0.01"
                required
                bind:value={purchasePrice}
                disabled={busy}
              /></label
            ><label class="field"
              ><span>Data de entrada</span><input
                type="date"
                required
                bind:value={acquisitionDate}
                disabled={busy}
              /></label
            >
          </div>
          <p class="muted">
            Despesas e estado atual mantêm-se. Não precisa de indicar valores das viaturas
            seguintes.
          </p>
        {/if}
        {#if (step === 'choose' || sale.cancelledAt) && deleteBlocked}<div class="blocked">
            <strong>O registo desta venda tem de ficar no histórico</strong>
            <ul>
              {#each info?.deletionBlockers.length ? info.deletionBlockers : ['Atualize a página para verificar os registos associados.'] as blocker}<li
                >
                  {blocker}
                </li>{/each}
            </ul>
            {#if !sale.cancelledAt}<p>Pode desfazer o negócio com a opção acima.</p>{/if}
          </div>{/if}
        {#if step !== 'choose' && !sale.cancelledAt}<details class="optional-note">
            <summary>Adicionar nota (opcional)</summary><label class="field"
              ><span>Nota para o registo</span><textarea
                bind:value={note}
                maxlength="440"
                rows="2"
                disabled={busy}
              ></textarea></label
            >
          </details>{/if}
        {#if step !== 'choose'}<div class="actions">
            <Button variant="outline" disabled={busy} onclick={back}>Voltar</Button
            >{#if step === 'purchase'}<Button
                type="submit"
                variant="primary"
                loading={busy}
                disabled={busy}>Rever alteração</Button
              >{/if}
          </div>{/if}
        {#if busy}<p role="status" class="muted">A verificar os efeitos…</p>{/if}
      </form>
    {/if}
    {#if info?.followingVehicles.length}<details class="chain">
        <summary>Ver viaturas seguintes preservadas ({info.followingVehicles.length})</summary>
        <ul>
          {#each info.followingVehicles as vehicle}<li>
              <a href={crmPath(`/viaturas/${vehicle.id}`)}>{vehicle.label}</a><small
                >{vehicle.sold
                  ? 'Venda preservada'
                  : 'Ficha de stock preservada'}{#if vehicle.id !== info.tradeIn?.id}
                  · entrada mantém-se: {formatEUR(vehicle.purchasePrice)}{/if}</small
              >
            </li>{/each}
        </ul>
      </details>{/if}
  </div>
</dialog>

<style>
  .sale-resolution-dialog {
    padding: 0;
    width: min(620px, calc(100vw - 32px));
    max-width: none;
    max-height: calc(100dvh - 32px);
    margin: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-card, 12px);
    background: var(--color-bg-2);
    color: var(--color-text);
  }
  .sale-resolution-dialog::backdrop {
    background: rgb(0 0 0 / 0.65);
  }
  :global(html:has(dialog.sale-resolution-dialog[open])) {
    overflow: hidden;
  }
  .content {
    padding: 26px;
    display: grid;
    gap: 22px;
  }
  .topline {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }
  .eyebrow {
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .close-dialog {
    flex-shrink: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    min-height: 36px;
    padding: 5px;
    cursor: pointer;
    font-size: 12px;
  }
  header {
    display: grid;
    gap: 8px;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  h2 {
    font-family: var(--font-display, inherit);
    font-size: 25px;
    line-height: 1.2;
    font-weight: 650;
  }
  h3 {
    font-size: 13px;
    font-weight: 600;
  }
  p,
  small {
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.6;
  }
  small {
    display: block;
    font-size: 12px;
  }
  form {
    display: grid;
    gap: 18px;
  }
  .choices {
    display: grid;
    gap: 10px;
  }
  .choices button {
    display: grid;
    grid-template-columns: 1fr 16px;
    gap: 5px 12px;
    text-align: left;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-1);
    color: var(--color-text);
    padding: 18px;
    cursor: pointer;
  }
  .choices strong {
    font-size: 14px;
    font-weight: 600;
  }
  .choices span {
    font-size: 12px;
    line-height: 1.6;
    color: var(--color-text-muted);
    grid-column: 1;
  }
  .choices b {
    grid-column: 2;
    grid-row: 1 / 3;
    align-self: center;
    font-weight: 400;
    color: var(--color-text-muted);
  }
  .choices button:hover:not(:disabled) {
    border-color: var(--color-red);
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  summary:focus-visible {
    outline: 2px solid var(--color-red);
    outline-offset: 3px;
  }
  .field-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .field {
    display: grid;
    gap: 7px;
    min-width: 0;
    font-size: 12px;
  }
  .field input,
  .field textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 12px;
    background: var(--color-bg-1);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text);
    font-size: 15px;
    min-height: 46px;
  }
  .field textarea {
    resize: vertical;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .notice,
  .blocked {
    padding: 14px;
    border: 1px solid var(--color-border);
    border-radius: 7px;
    background: var(--color-bg-1);
    font-size: 12px;
    line-height: 1.6;
  }
  .blocked strong {
    font-size: 12px;
  }
  .blocked ul,
  .destructive ul {
    padding-left: 18px;
    margin: 8px 0;
    font-size: 12px;
    line-height: 1.7;
    color: var(--color-text-muted);
  }
  .blocked p {
    font-size: 12px;
  }
  .error {
    margin: 0;
    padding: 12px;
    border: 1px solid var(--color-red);
    border-radius: 6px;
    color: var(--color-red);
    font-size: 13px;
    line-height: 1.6;
  }
  .summary {
    display: grid;
    gap: 12px;
  }
  .summary article {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 16px;
    display: grid;
    gap: 7px;
  }
  .summary strong {
    font-size: 15px;
    font-weight: 600;
  }
  .destructive {
    padding: 14px;
    border: 1px solid color-mix(in srgb, var(--color-red) 40%, var(--color-border));
    border-radius: 7px;
  }
  .destructive h3 {
    color: var(--color-red);
  }
  .destructive p {
    font-size: 12px;
  }
  details {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  summary {
    cursor: pointer;
    line-height: 1.7;
    min-height: 30px;
  }
  details p,
  details small {
    margin-top: 8px;
  }
  .optional-note textarea {
    margin-top: 7px;
  }
  .chain {
    border-top: 1px solid var(--color-border);
    padding-top: 14px;
  }
  .chain ul {
    padding: 0;
    list-style: none;
    margin: 10px 0 0;
    display: grid;
    gap: 10px;
  }
  .chain a {
    text-decoration: underline;
    text-underline-offset: 3px;
    color: var(--color-text);
    font-size: 12px;
  }
  .chain small {
    font-size: 11px;
  }
  .muted {
    font-size: 12px;
  }
  @media (max-width: 640px) {
    .content {
      padding: 18px;
      gap: 20px;
    }
    .field-pair {
      grid-template-columns: 1fr;
    }
    h2 {
      font-size: 22px;
    }
    .choices button {
      padding: 15px;
    }
    .actions :global(button) {
      white-space: normal;
      height: auto;
      min-height: 44px;
      line-height: 1.4;
    }
    .topline .eyebrow {
      max-width: 210px;
      line-height: 1.5;
    }
  }
</style>
