<script lang="ts">
  import type { DashboardPayload } from '$lib/server/dashboard';
  import { formatEUR } from '$lib/utils/format';
  let {
    data,
    monthKeys,
  }: { data: NonNullable<DashboardPayload['fiscalVat']>; monthKeys: string[] } = $props();
  let period = $state('year');
  const year = $derived(monthKeys.at(-1)?.slice(0, 4) ?? '');
  const rows = $derived(
    data.months.filter(
      (r) =>
        period === 'all' || (period === 'year' ? r.month.startsWith(year) : r.month === period),
    ),
  );
  const payable = $derived(rows.reduce((n, r) => n + Math.round(Number(r.payable) * 100), 0) / 100);
  const deductible = $derived(
    rows.reduce((n, r) => n + Math.round(Number(r.deductible) * 100), 0) / 100,
  );
  const balance = $derived(Math.round((payable - deductible) * 100) / 100);
</script>

<section
  class="border border-[var(--color-border)] bg-[var(--color-bg-1)] p-5 space-y-4 rounded-sm"
>
  <div class="flex flex-wrap justify-between gap-3">
    <h2 class="font-semibold">IVA por período fiscal</h2>
    <label class="text-[12px]"
      >Período <select
        bind:value={period}
        class="bg-[var(--color-bg-2)] border border-[var(--color-border)] p-2"
        ><option value="year">Ano atual</option><option value="all">Últimos 12 meses</option
        >{#each monthKeys as month}<option value={month}>{month}</option>{/each}</select
      ></label
    >
  </div>
  <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div>
      <dt>IVA a pagar (vendas + comissões)</dt>
      <dd class="num-value text-[24px]">{formatEUR(payable)}</dd>
    </div>
    <div>
      <dt>IVA a deduzir (despesas)</dt>
      <dd class="num-value text-[24px]">{formatEUR(deductible)}</dd>
    </div>
    <div>
      <dt>{balance < 0 ? 'Crédito estimado' : 'Saldo estimado a entregar'}</dt>
      <dd class="num-value text-[24px]">{formatEUR(Math.abs(balance))}</dd>
    </div>
  </dl>
  <p class="text-[12px] text-[var(--color-text-muted)]">
    Pela data fiscal de cada documento, incluindo despesas de viaturas em stock. O saldo não é
    descontado novamente ao resultado.
  </p>
  {#if data.pendingDocuments}<p class="text-[12px] text-[var(--color-warning)]">
      {data.pendingDocuments} registos com informação fiscal por confirmar no histórico global. Os componentes
      não documentados estão excluídos; este resumo é incompleto.
    </p>{/if}
</section>
