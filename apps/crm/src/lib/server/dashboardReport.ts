import type { DashboardPayload } from './dashboard';
export function dashboardCsvTable(data: DashboardPayload) {
  const c = data.salesChart;
  const headers = [
    'Mês',
    'Vendas',
    'Faturação (€)',
    'Lucro das vendas (€)',
    'Comissões (€)',
    'Margem %',
    'IVA (€)',
    'Despesas operacionais (€)',
    'Resultado após despesas (€)',
  ];
  const rows: (string | number)[][] = c.monthKeys.map((month, i) => [
    month,
    c.sold[i] ?? 0,
    (c.revenue[i] ?? 0).toFixed(2),
    (c.profit[i] ?? 0).toFixed(2),
    (c.commission[i] ?? 0).toFixed(2),
    c.revenue[i] ? (((c.profit[i] ?? 0) / c.revenue[i]!) * 100).toFixed(1) : '0.0',
    (c.vat[i] ?? 0).toFixed(2),
    (c.operatingExpenses[i] ?? 0).toFixed(2),
    (c.resultAfterExpenses[i] ?? 0).toFixed(2),
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
    t.operatingExpenses,
    t.resultAfterExpenses,
  ]);
  rows.push([
    'TOTAL ANO ATUAL',
    c.ytdSold,
    c.ytdRevenue,
    c.ytdProfit,
    c.ytdCommission,
    c.ytdAvgMarginPct?.toFixed(1) ?? '0.0',
    c.ytdVat,
    c.ytdOperatingExpenses,
    c.ytdResultAfterExpenses,
  ]);
  return { headers, rows };
}
