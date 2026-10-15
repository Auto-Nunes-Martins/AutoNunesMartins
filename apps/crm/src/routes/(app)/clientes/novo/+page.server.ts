import { fail } from '@sveltejs/kit';
import { customerCreateSchema } from '@anm/types';
import { customersApi } from '$lib/server/customers';
import { ApiError } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({});

function parseForm(fd: FormData) {
  const get = (k: string) => (fd.get(k) ?? '').toString().trim();
  const opt = (k: string) => {
    const v = get(k);
    return v === '' ? undefined : v;
  };
  return {
    name: get('name'),
    phone: get('phone'),
    email: opt('email'),
    address: opt('address'),
    nif: get('nif'),
    notes: opt('notes'),
  };
}

export const actions: Actions = {
  submit: async (event) => {
    const fd = await event.request.formData();
    const parsed = customerCreateSchema.safeParse(parseForm(fd));
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        issues: parsed.error.issues,
      });
    }
    try {
      const { id } = await customersApi.create(event, parsed.data);
      return { id };
    } catch (err) {
      if (err instanceof ApiError) {
        const feedback = err.body as {
          field?: string;
          issues?: { path: (string | number)[]; message: string }[];
        } | null;
        return fail(err.status, {
          field: feedback?.field,
          issues: feedback?.issues,
          error: (err.body as { error?: string } | null)?.error ?? 'Falha ao criar cliente.',
        });
      }
      throw err;
    }
  },
};
