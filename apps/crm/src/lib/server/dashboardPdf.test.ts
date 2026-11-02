import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { buildDashboardPdf } from './dashboardPdf';
import { buildPdfTable } from './exports';
import type { DashboardPayload } from './dashboard';

afterEach(() => vi.useRealTimers());

it('preserves the exact dashboard and table PDF bytes recorded before the module extraction', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T12:00:00.000Z'));
  const money = { current: '12345.67', previous: '10000.00', deltaPct: 23.46 };
  const series = Array.from({ length: 12 }, (_, index) => index + 1);
  const data = {
    kpis: {
      vendasMes: { count: 12, previousCount: 10, deltaPct: 20 },
      faturacaoMes: money,
      lucroMes: money,
      comissoesMes: money,
      despesasOperacionaisMes: money,
      resultadoAposDespesasMes: money,
      margemMedia: { current: 15.5, previous: 14.1, deltaPct: 9.93 },
      sparklines: {
        vendas: series,
        faturacao: series,
        lucro: series,
        comissoes: series,
        margem: series,
      },
    },
    salesChart: { months: series.map(String), sold: series, revenue: series.map((n) => n * 10000) },
    bestSellers: [{ rank: 1, brand: 'Fixture', model: 'Sintético', count: 2 }],
    alerts: {
      stockAged: 2,
      stockAgingDays: 60,
      tasksDueOrOverdue: 3,
      remindersToday: 1,
      draftVehicles: 4,
    },
  } as DashboardPayload;
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  // Generated from ad704756 with the same fixed clock and locked pdf-lib version.
  expect(digest(await buildDashboardPdf(data))).toBe(
    'e40b22fe166e9c19fe819872d9415b6f910910d892be54376810769b4553b42c',
  );
  expect(
    digest(
      await buildPdfTable({
        title: 'Relatório sintético',
        headers: ['Nome', 'Valor'],
        rows: [
          ['José', '12,50 €'],
          ['Linha →', '0'],
        ],
      }),
    ),
  ).toBe('e0940d0ed41b49fa59bd0cde23c4a330d6c1bf06e44bc4939cc5e1060ef59f60');
});
