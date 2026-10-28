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
    const { rows } = dashboardCsvTable(data);
    expect(rows).toHaveLength(14);
    for (let i = 0; i < 12; i++) expect(rows[i]?.slice(2, 5)).toEqual(Array(3).fill(`${i + 1}.00`));
    expect(rows[12]?.slice(0, 4)).toEqual(['TOTAL 12M', 78, '78.00', '78.00']);
    expect(rows[13]?.slice(0, 4)).toEqual(['TOTAL ANO ATUAL', 1, '1.00', '1.00']);
  });
});
