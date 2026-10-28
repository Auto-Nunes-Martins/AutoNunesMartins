import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaleListItem, SaleListResponse } from './sales';
const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }));
vi.mock('./api.js', () => mocks);
import { salesApi } from './sales';
import { GET } from '../../routes/(app)/vendas/export/+server';
import { PDFDocument } from 'pdf-lib';
const items = Array.from(
  { length: 205 },
  (_, i) =>
    ({
      id: `sale-${i}`,
      saleDate: '2026-01-01',
      salePrice: '100',
      purchasePrice: '50',
      expensesTotal: '10',
      vatAmount: '5',
      commission: '2',
      realProfit: '37',
      marginPct: 37,
      vehicle: { brand: 'Ford', model: `Car-${i}`, year: 2020 },
      customer: { name: `Client-${i}` },
    }) as SaleListItem,
);
const totals = {
  count: 205,
  revenue: '20500',
  expenses: '2050',
  vat: '1025',
  commission: '410',
  profit: '7585',
  avgMarginPct: 37,
};
beforeEach(() => {
  mocks.apiJson.mockReset().mockImplementation(async (_event, path: string) => {
    const page = Number(new URL(path, 'http://test').searchParams.get('page'));
    return {
      items: items.slice((page - 1) * 100, page * 100),
      total: 205,
      totalPages: 3,
      page,
      pageSize: 100,
      totals,
    } satisfies SaleListResponse;
  });
});
describe('complete filtered sales exports', () => {
  it('generates a multipage PDF for all 205 sales', async () => {
    const response = await GET({ url: new URL('http://test/vendas/export?format=pdf') } as any);
    const pdf = await PDFDocument.load(await response.arrayBuffer());
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(mocks.apiJson).toHaveBeenCalledTimes(3);
  });
  it('exports all 205 CSV rows, preserving filters and backend page cap', async () => {
    const response = await GET({
      url: new URL('http://test/vendas/export?format=csv&q=Ford&dateFrom=2026-01-01&sortDir=asc'),
    } as any);
    const csv = await response.text();
    expect(csv.trim().split(/\r?\n/)).toHaveLength(206);
    expect(csv).toContain('Client-204');
    expect(mocks.apiJson).toHaveBeenCalledTimes(3);
    for (const [, path] of mocks.apiJson.mock.calls) {
      const query = new URL(path, 'http://test').searchParams;
      expect(query.get('q')).toBe('Ford');
      expect(query.get('dateFrom')).toBe('2026-01-01');
      expect(query.get('sortDir')).toBe('asc');
      expect(query.get('pageSize')).toBe('100');
    }
  });
  it('refuses an incomplete export if data changes or repeats between pages', async () => {
    mocks.apiJson
      .mockResolvedValueOnce({ items: items.slice(0, 100), total: 205, totalPages: 3, totals })
      .mockResolvedValueOnce({ items: items.slice(0, 100), total: 205, totalPages: 3, totals })
      .mockResolvedValueOnce({ items: items.slice(200), total: 205, totalPages: 3, totals });
    await expect(salesApi.listAll({} as any)).rejects.toThrow('Repita');
    mocks.apiJson
      .mockResolvedValueOnce({ items: items.slice(0, 100), total: 205, totalPages: 3, totals })
      .mockResolvedValueOnce({ items: items.slice(100, 200), total: 204, totalPages: 3, totals });
    await expect(salesApi.listAll({} as any)).rejects.toThrow('Repita');
  });
});
