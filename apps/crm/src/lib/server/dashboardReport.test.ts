import { describe, expect, it } from 'vitest';
import { dashboardCsvTable } from './dashboardReport';
import type { DashboardPayload } from './dashboard';
describe('dashboard CSV financial periods', () => {
  it('includes financial values for every month and distinguishes rolling 12M from calendar YTD', () => {
    const series = Array.from({ length: 12 }, (_, i) => i + 1);
    const data = {
      salesChart: {
        monthKeys: series.map((_, i) => `2025-${String(i + 1).padStart(2, '0')}`),
        sold: series,
        revenue: series,
        profit: series,
        commission: series,
        vat: series,
        operatingExpenses: series,
        resultAfterExpenses: series,
        totals12m: {
          sold: 78,
          revenue: '78.00',
          profit: '78.00',
          commission: '78.00',
          vat: '78.00',
          operatingExpenses: '78.00',
          resultAfterExpenses: '0.00',
        },
        ytdSold: 1,
        ytdRevenue: '1.00',
        ytdProfit: '1.00',
        ytdCommission: '1.00',
        ytdAvgMarginPct: 100,
        ytdVat: '1.00',
        ytdOperatingExpenses: '1.00',
        ytdResultAfterExpenses: '0.00',
      },
    } as DashboardPayload;
    data.fiscalVat = {
      months: [{ month: '2025-01', payable: '1.00', deductible: '23.00', balance: '-22.00' }],
      pendingDocuments: 2,
    };
    const { rows, headers } = dashboardCsvTable(data);
    expect(headers.slice(6, 9)).toEqual([
      'IVA a pagar — vendas + comissões (€)',
      'IVA a deduzir — despesas (€)',
      'Saldo estimado de IVA (€)',
    ]);
    expect(rows[0]?.slice(6, 9)).toEqual(['1.00', '23.00', '-22.00']);
    expect(rows[12]?.slice(6, 9)).toEqual(['78.00', '23.00', '55.00']);
    expect(rows[0]?.at(-1)).toBe(2);
    expect(rows).toHaveLength(14);
    for (let i = 0; i < 12; i++) expect(rows[i]?.slice(2, 5)).toEqual(Array(3).fill(`${i + 1}.00`));
    expect(rows[12]?.slice(0, 4)).toEqual(['TOTAL 12M', 78, '78.00', '78.00']);
    expect(rows[13]?.slice(0, 4)).toEqual(['TOTAL ANO ATUAL', 1, '1.00', '1.00']);
  });
});
