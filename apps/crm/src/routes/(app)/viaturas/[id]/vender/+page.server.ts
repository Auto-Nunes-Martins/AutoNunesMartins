import { crmPath } from '$lib/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import { customerCreateSchema, saleCreateSchema } from '@anm/types';
import { vehiclesApi } from '$lib/server/vehicles';
import { customersApi } from '$lib/server/customers';
import { salesApi } from '$lib/server/sales';
import { ApiError, rethrowAuthError } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    const vehicle = await vehiclesApi.get(event, event.params.id);
    if (vehicle.sale) {
      throw redirect(302, crmPath(`/viaturas/${event.params.id}`));
    }
    if (!['AVAILABLE', 'RESERVED', 'DOCS_PENDING'].includes(vehicle.status)) {
      throw redirect(302, crmPath(`/viaturas/${event.params.id}`));
    }
    // Pre-load customers for the picker. Cap at 200 — fine for a small dealership.
    const customers = await customersApi.list(event, {
      page: 1,
      pageSize: 200,
      sortBy: 'name',
      sortDir: 'asc',
    });
    return { vehicle, customers: customers.items };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, 'Viatura não encontrada');
    }
    rethrowAuthError(err);
    throw err;
  }
};

function parseForm(fd: FormData) {
  const get = (k: string) => (fd.get(k) ?? '').toString().trim();
  // Trade-in is only assembled when the user explicitly toggled it on. Each
  // `tradeIn.*` field is read raw and let the Zod schema coerce/validate.
  // Omitting the field entirely (rather than sending an empty object) keeps
  // the API contract clean — saleCreateSchema treats `tradeIn` as optional.
  const tradeInEnabled = get('hasTradeIn') === 'true';
  const tradeIn = tradeInEnabled
    ? {
        brand: get('tradeIn.brand'),
        model: get('tradeIn.model'),
        year: get('tradeIn.year'),
        fuel: get('tradeIn.fuel'),
        mileage: get('tradeIn.mileage'),
        licensePlate: get('tradeIn.licensePlate') || undefined,
        vin: get('tradeIn.vin') || undefined,
        allowanceValue: get('tradeIn.allowanceValue'),
        disposition: get('tradeIn.disposition'),
        notes: get('tradeIn.notes') || undefined,
        pendingDocFlags:
          get('tradeIn.disposition') === 'STOCK'
            ? {
                financing: get('tradeIn.pendingDocFlags.financing') === 'true',
                imt: get('tradeIn.pendingDocFlags.imt') === 'true',
                registration: get('tradeIn.pendingDocFlags.registration') === 'true',
                docs: get('tradeIn.pendingDocFlags.docs') === 'true',
              }
            : undefined,
      }
    : undefined;
  return {
    vehicleId: get('vehicleId'),
    customerId: get('customerId'),
    salePrice: get('salePrice'),
    saleDate: get('saleDate'),
    deliveryDate: get('deliveryDate') || undefined,
    deliveryStatus: get('deliveryStatus') || 'PENDING',
    // Empty field → "0" so the schema's default kicks in cleanly and the
    // resulting sale row stores 0 rather than NULL or a stray string.
    commission: get('commission') || '0',
    buyerType: get('buyerType') || 'PARTICULAR',
    ...(tradeIn ? { tradeIn } : {}),
  };
}

export const actions: Actions = {
  createCustomer: async (event) => {
    const fd = await event.request.formData();
    const get = (key: string) => String(fd.get(key) ?? '').trim();
    const parsed = customerCreateSchema.safeParse({
      name: get('name'),
      nif: get('nif'),
      phone: get('phone'),
      email: get('email') || undefined,
      address: get('address') || undefined,
      notes: get('notes') || undefined,
    });
    if (!parsed.success)
      return fail(400, { error: 'Reveja os dados do cliente.', issues: parsed.error.issues });
    try {
      const { id } = await customersApi.create(event, parsed.data);
      const now = new Date().toISOString();
      return {
        id,
        customer: {
          ...parsed.data,
          id,
          email: parsed.data.email ?? null,
          address: parsed.data.address ?? null,
          notes: parsed.data.notes ?? null,
          lastContactDate: null,
          createdAt: now,
          updatedAt: now,
          _count: { sales: 0 },
        },
      };
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      const body = err.body as {
        error?: string;
        field?: string;
        issues?: { path: (string | number)[]; message: string }[];
      } | null;
      return fail(err.status, {
        error: body?.error ?? 'Não foi possível criar o cliente.',
        field: body?.field,
        issues: body?.issues,
      });
    }
  },
  submit: async (event) => {
    const fd = await event.request.formData();
    const raw = parseForm(fd);
    if (raw.vehicleId !== event.params.id) {
      return fail(400, { error: 'Veículo inconsistente.' });
    }
    const parsed = saleCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        issues: parsed.error.issues,
      });
    }
    try {
      const { id } = await salesApi.create(event, parsed.data);
      return { id };
    } catch (err) {
      if (err instanceof ApiError) {
        // Forward field when the backend identifies a conflict in a specific
        // trade-in input, such as VIN or license plate. The UI uses this to
        // highlight that input without clearing the rest of the form.
        const body = err.body as {
          error?: string;
          field?: string;
          issues?: { path: (string | number)[]; message: string }[];
        } | null;
        return fail(err.status, {
          error: body?.error ?? 'Falha ao registar venda.',
          field: body?.field ?? null,
          issues: body?.issues,
        });
      }
      throw err;
    }
  },
};
