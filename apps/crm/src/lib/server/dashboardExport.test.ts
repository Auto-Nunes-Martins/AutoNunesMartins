import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), pdfLoaded: vi.fn(), engineLoaded: vi.fn() }));
vi.mock('$lib/server/dashboard', () => ({ dashboardApi: { get: mocks.get } }));
vi.mock('$lib/server/dashboardPdf', () => {
  mocks.pdfLoaded();
  return { buildDashboardPdf: async () => new Uint8Array([37, 80, 68, 70]) };
});
vi.mock('pdf-lib', () => {
  mocks.engineLoaded();
  throw Error('CSV must not load the PDF engine');
});
import { GET } from '../../routes/(app)/dashboard/export/+server';

it('loads the PDF renderer only for the PDF branch while keeping CSV available', async () => {
  const totals = {
    sold: 0,
    revenue: '0',
    profit: '0',
    commission: '0',
    vat: '0',
    operatingExpenses: '0',
    resultAfterExpenses: '0',
  };
  mocks.get.mockResolvedValue({
    salesChart: {
      monthKeys: [],
      sold: [],
      revenue: [],
      profit: [],
      commission: [],
      vat: [],
      operatingExpenses: [],
      resultAfterExpenses: [],
      totals12m: totals,
      ytdSold: 0,
      ytdRevenue: '0',
      ytdProfit: '0',
      ytdCommission: '0',
      ytdVat: '0',
      ytdOperatingExpenses: '0',
      ytdResultAfterExpenses: '0',
    },
  });
  const event = (format: string) =>
    ({ url: new URL(`http://fixture.test/export?format=${format}`) }) as Parameters<typeof GET>[0];
  const csv = await GET(event('csv'));
  expect(csv.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  expect(await csv.text()).toContain('TOTAL 12M');
  expect(mocks.pdfLoaded).not.toHaveBeenCalled();
  expect(mocks.engineLoaded).not.toHaveBeenCalled();
  expect((await GET(event('pdf'))).headers.get('content-type')).toBe('application/pdf');
  expect(mocks.pdfLoaded).toHaveBeenCalledOnce();
});
