import { dashboardCsvTable } from '$lib/server/dashboardReport';
import { error, type RequestHandler } from '@sveltejs/kit';
import { dashboardApi } from '$lib/server/dashboard';
import { buildCsv } from '$lib/server/exports';

export const GET: RequestHandler = async (event) => {
  const sp = event.url.searchParams;
  const format = sp.get('format') === 'pdf' ? 'pdf' : 'csv';

  const data = await dashboardApi.get(event);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `dashboard_${today}.${format}`;

  // ─── CSV ────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const { headers, rows } = dashboardCsvTable(data);
    const csv = buildCsv(headers, rows);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  // ─── PDF ────────────────────────────────────────────────────────────
  try {
    const { buildDashboardPdf } = await import('$lib/server/dashboardPdf');
    const pdfBytes = await buildDashboardPdf(data);
    return new Response(new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Dashboard PDF export failed:', err);
    throw error(500, 'Falha ao gerar PDF do dashboard');
  }
};
