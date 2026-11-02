import { error } from '@sveltejs/kit';
import { apiJson, rethrowAuthError } from '$lib/server/api';
import type { PublicReview } from '@anm/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    return await apiJson<{ items: PublicReview[] }>(event, '/api/reviews');
  } catch (err) {
    rethrowAuthError(err);
    error(503, 'Não foi possível carregar as reviews. Tente novamente.');
  }
};
