import { fail } from '@sveltejs/kit';
import { apiJson, ApiError, rethrowAuthError } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

interface CampaignEditor {
  revision: string | null;
  items: {
    vehicleId: string;
    price: string;
    referencePrice: string;
    evidence: string;
    durationDays: number;
    startsAt: string;
    endsAt: string;
  }[];
  candidates: {
    id: string;
    brand: string;
    model: string;
    year: number;
    licensePlate: string | null;
    price: string;
  }[];
}

export const load: PageServerLoad = async (event) => {
  const editor = await apiJson<CampaignEditor>(event, '/api/vehicle-campaigns', {
    signal: AbortSignal.timeout(10_000),
  }).catch((error) => {
    rethrowAuthError(error);
    return null;
  });
  return { editor };
};

export const actions: Actions = {
  default: async (event) => {
    let input: unknown;
    try {
      const raw = (await event.request.formData()).get('campaigns');
      if (typeof raw !== 'string' || raw.length > 5000)
        return fail(400, { error: 'Campanhas inválidas.' });
      input = JSON.parse(raw);
    } catch {
      return fail(400, { error: 'Campanhas inválidas.' });
    }
    try {
      await apiJson(event, '/api/vehicle-campaigns', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return { saved: true };
    } catch (error) {
      if (error instanceof ApiError) {
        return fail(error.status, {
          error:
            (error.body as { error?: string })?.error ?? 'Não foi possível guardar as campanhas.',
        });
      }
      return fail(503, { error: 'Não foi possível guardar. Pode voltar a tentar.' });
    }
  },
};
