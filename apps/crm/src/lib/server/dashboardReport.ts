import type { DashboardPayload } from './dashboard';
export function dashboardCsvTable(data: DashboardPayload) {
  const c = data.salesChart;
  const deductible = (months: string[]) =>
    (data.fiscalVat?.months ?? [])
      .filter((r) => months.includes(r.month))
      .reduce((n, r) => n + Math.round(Number(r.deductible) * 100), 0) / 100;
  const allDeductible = deductible(c.monthKeys);
  const yearDeductible = deductible(
    c.monthKeys.filter((m) => m.startsWith(c.monthKeys.at(-1)?.slice(0, 4) ?? '')),
  );
  const headers = [
    'Mês',
    'Vendas',
    'Faturação (€)',
    'Lucro das vendas (€)',
    'Comissões (€)',
    'Margem %',
    'IVA a pagar — vendas + comissões (€)',
    'IVA a deduzir — despesas (€)',
    'Saldo estimado de IVA (€)',
    'Despesas operacionais (€)',
    'Resultado após despesas (€)',
    'Registos fiscais pendentes (histórico global)',
  ];
  const rows: (string | number)[][] = c.monthKeys.map((month, i) => [
    month,
    c.sold[i] ?? 0,
    (c.revenue[i] ?? 0).toFixed(2),
    (c.profit[i] ?? 0).toFixed(2),
    (c.commission[i] ?? 0).toFixed(2),
    c.revenue[i] ? (((c.profit[i] ?? 0) / c.revenue[i]!) * 100).toFixed(1) : '0.0',
    (c.vat[i] ?? 0).toFixed(2),
    deductible([month]).toFixed(2),
    ((c.vat[i] ?? 0) - deductible([month])).toFixed(2),
    (c.operatingExpenses[i] ?? 0).toFixed(2),
    (c.resultAfterExpenses[i] ?? 0).toFixed(2),
    data.fiscalVat?.pendingDocuments ?? 0,
  ]);
  const t = c.totals12m;
  rows.push([
    'TOTAL 12M',
    t.sold,
    t.revenue,
    t.profit,
    t.commission,
    Number(t.revenue) ? ((Number(t.profit) / Number(t.revenue)) * 100).toFixed(1) : '0.0',
    t.vat,
    allDeductible.toFixed(2),
    (Number(t.vat) - allDeductible).toFixed(2),
    t.operatingExpenses,
    t.resultAfterExpenses,
    data.fiscalVat?.pendingDocuments ?? 0,
  ]);
  rows.push([
    'TOTAL ANO ATUAL',
    c.ytdSold,
    c.ytdRevenue,
    c.ytdProfit,
    c.ytdCommission,
    c.ytdAvgMarginPct?.toFixed(1) ?? '0.0',
    c.ytdVat,
    yearDeductible.toFixed(2),
    (Number(c.ytdVat) - yearDeductible).toFixed(2),
    c.ytdOperatingExpenses,
    c.ytdResultAfterExpenses,
    data.fiscalVat?.pendingDocuments ?? 0,
  ]);
  return { headers, rows };
}
