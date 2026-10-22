import { error, fail } from '@sveltejs/kit';
import { vehicleExpenseCreateSchema, vehicleExpenseUpdateSchema } from '@anm/types';
import { vehiclesApi } from '$lib/server/vehicles';
import { expensesApi } from '$lib/server/vehicleExpenses';
import { dashboardApi } from '$lib/server/dashboard';
import { ApiError, rethrowAuthError } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    const vehicle = await vehiclesApi.get(event, event.params.id);

    // Only the vehicle is required to render the page. Start independent
    // lookups together and stream them so storage cannot block its details.
    const signedPhotos =
      vehicle.photos.length > 0
        ? vehiclesApi
            .signedPhotos(event, event.params.id)
            .then(({ photos }) => photos)
            .catch((err) => {
              rethrowAuthError(err);
              throw error(
                503,
                'Não foi possível carregar as fotografias. Atualize a página para tentar novamente.',
              );
            })
        : Promise.resolve([]);

    // Whether THIS vehicle is the one currently pinned as Dashboard hero.
    const isFeatured = dashboardApi
      .highlights(event)
      .then(({ items }) => items.some((item) => item.id === vehicle.id))
      .catch((err) => {
        rethrowAuthError(err);
        return false;
      });
    // SvelteKit owns delivery of streamed rejections. Attach handlers now as
    // either lookup can fail before the initial response has been serialized.
    void signedPhotos.catch(() => {});
    void isFeatured.catch(() => {});

    return { vehicle, signedPhotos, isFeatured };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, 'Viatura não encontrada');
    }
    rethrowAuthError(err);
    throw err;
  }
};

export const actions: Actions = {
  addExpense: async (event) => {
    const fd = await event.request.formData();
    const get = (k: string) => (fd.get(k) ?? '').toString();
    const raw = {
      vehicleId: event.params.id,
      category: get('category'),
      description: get('description'),
      amount: get('amount'),
      date: get('date'),
      confirmedOnSold: fd.get('confirmedOnSold') === 'true',
    };
    const parsed = vehicleExpenseCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
      });
    }
    try {
      await expensesApi.create(event, parsed.data, raw.confirmedOnSold);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { error?: string; message?: string } | null;
        if (body?.error === 'SaleExistsConfirmationRequired') {
          return fail(409, {
            error: body.message ?? 'Esta viatura já está vendida.',
            soldConfirmRequired: true,
          });
        }
      }
      if (err instanceof ApiError) {
        return fail(err.status, {
          error: (err.body as { error?: string } | null)?.error ?? 'Falha.',
        });
      }
      throw err;
    }
  },
  updateExpense: async (event) => {
    const fd = await event.request.formData();
    const get = (k: string) => (fd.get(k) ?? '').toString();
    const expenseId = get('expenseId');
    if (!expenseId) return fail(400, { error: 'expenseId em falta' });
    const confirmedOnSold = fd.get('confirmedOnSold') === 'true';
    const raw = {
      id: expenseId,
      category: get('category'),
      description: get('description'),
      amount: get('amount'),
      date: get('date'),
      confirmedOnSold,
    };
    const parsed = vehicleExpenseUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        expenseId,
      });
    }
    const { id: _id, ...patch } = parsed.data;
    try {
      await expensesApi.update(event, expenseId, patch, confirmedOnSold);
      return { ok: true, expenseId };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        return fail(409, {
          error:
            (err.body as { message?: string } | null)?.message ?? 'Esta viatura já está vendida.',
          soldConfirmRequired: true,
          expenseId,
        });
      }
      if (err instanceof ApiError) {
        return fail(err.status, {
          error: (err.body as { error?: string } | null)?.error ?? 'Falha.',
          expenseId,
        });
      }
      throw err;
    }
  },
  deleteExpense: async (event) => {
    const fd = await event.request.formData();
    const expenseId = (fd.get('expenseId') ?? '').toString();
    const confirmedOnSold = fd.get('confirmedOnSold') === 'true';
    if (!expenseId) return fail(400, { error: 'expenseId em falta' });
    try {
      await expensesApi.delete(event, expenseId, confirmedOnSold);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        return fail(409, {
          error:
            (err.body as { message?: string } | null)?.message ?? 'Esta viatura já está vendida.',
          soldConfirmRequired: true,
        });
      }
      if (err instanceof ApiError) {
        return fail(err.status, {
          error: (err.body as { error?: string } | null)?.error ?? 'Falha.',
        });
      }
      throw err;
    }
  },
};
