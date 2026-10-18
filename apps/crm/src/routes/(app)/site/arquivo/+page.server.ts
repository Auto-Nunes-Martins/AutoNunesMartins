import { error, fail } from '@sveltejs/kit';
import { apiJson, ApiError } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';
type Archive = {
  slug: string;
  brand: string;
  model: string;
  year: number;
  identificationAllowed: boolean;
  photoAllowed: boolean;
  hasPhoto: boolean;
  canAuthorize: boolean;
};
export const load: PageServerLoad = async (event) => {
  const q = event.url.searchParams.get('q')?.slice(0, 200) ?? '';
  try {
    return {
      ...(await apiJson<{ items: Archive[]; truncated: boolean }>(
        event,
        `/api/public-archives?q=${encodeURIComponent(q)}`,
      )),
      q,
    };
  } catch {
    error(503, 'Não foi possível carregar o arquivo público.');
  }
};
export const actions: Actions = {
  default: async (event) => {
    const data = await event.request.formData();
    const slug = data.get('slug'),
      action = data.get('action');
    if (
      typeof slug !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 180 ||
      !['withdraw', 'withdraw-photo', 'authorize-current'].includes(String(action))
    )
      return fail(400, { error: 'Pedido inválido.' });
    try {
      await apiJson(event, `/api/public-archives/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      return { saved: true };
    } catch (err) {
      return fail(err instanceof ApiError ? err.status : 503, {
        error:
          err instanceof ApiError
            ? ((err.body as { error?: string })?.error ?? 'Não foi possível guardar.')
            : 'Não foi possível guardar.',
      });
    }
  },
};
