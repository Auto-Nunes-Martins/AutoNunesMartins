import { error, fail } from '@sveltejs/kit';
import { apiJson, ApiError, rethrowAuthError } from '$lib/server/api';
import type { HighlightsEditor } from '$lib/homepageHighlights';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    return { editor: await apiJson<HighlightsEditor>(event, '/api/homepage-highlights'), selectedVehicleId: event.url.searchParams.get('viatura') };
  } catch (err) {
    rethrowAuthError(err);
    error(503, 'Não foi possível carregar os destaques. Tente novamente.');
  }
};
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
      await apiJson(event, '/api/homepage-highlights', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return { saved: true };
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
