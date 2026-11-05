import { fail } from '@sveltejs/kit';
import { apiErrorMessage, apiJson, ApiError } from '$lib/server/api';
import type { HighlightsEditor } from '$lib/homepageHighlights';
import type { Actions, PageServerLoad } from './$types';

export const load = ((event) => {
  event.depends('crm:homepage-highlights');
  const editor = apiJson<HighlightsEditor>(event, '/api/homepage-highlights', {
    signal: AbortSignal.timeout(10_000),
  }).then(
    (editor) => ({ ok: true as const, editor }),
    (err: unknown) => {
      const status = err instanceof ApiError ? err.status : 503;
      const message = [401, 403].includes(status)
        ? apiErrorMessage(status)
        : 'Não foi possível carregar os destaques. Tente novamente.';
      return { ok: false as const, status, message };
    },
  );
  return { editor, selectedVehicleId: event.url.searchParams.get('viatura') };
}) satisfies PageServerLoad;
export const actions: Actions = {
  default: async (event) => {
    const data = await event.request.formData();
    let input: unknown;
    try {
      const raw = data.get('selection');
      if (typeof raw !== 'string' || raw.length > 10000)
        return fail(400, { error: 'Seleção inválida.' });
      input = JSON.parse(raw);
    } catch {
      return fail(400, { error: 'Seleção inválida.' });
    }
    try {
      const { revision } = await apiJson<{ revision: string }>(event, '/api/homepage-highlights', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return { saved: true, revision };
    } catch (err) {
      if (err instanceof ApiError)
        return fail(err.status, {
          error:
            (err.body as { error?: string })?.error ?? 'Não foi possível guardar os destaques.',
        });
      return fail(503, {
        error: 'Não foi possível guardar. A sua seleção mantém-se para voltar a tentar.',
      });
    }
  },
};
