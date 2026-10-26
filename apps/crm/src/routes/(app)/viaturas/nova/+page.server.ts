import { crmPath } from '$lib/paths';
import { fail, error, redirect } from '@sveltejs/kit';
import { vehicleCreateSchema } from '@anm/types';
import { vehiclesApi } from '$lib/server/vehicles';
import { ApiError, rethrowAuthError } from '$lib/server/api';
import { webPublicationAction } from '$lib/server/webPublication';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  const draftOwner = event.locals.auth().userId;
  const id = event.url.searchParams.get('viatura');
  if (!id) return { vehicle: null, signedPhotos: [], intendedStatus: 'AVAILABLE' as const, draftOwner };
  if (!/^c[a-z0-9]{24}$/.test(id)) error(400, 'Viatura inválida.');
  const vehicle = await vehiclesApi.get(event, id);
  const signedPhotos = await vehiclesApi
    .signedPhotos(event, id)
    .then((result) => result.photos)
    .catch((err) => {
      rethrowAuthError(err);
      return [];
    });
  const requested = event.url.searchParams.get('estado');
  const intendedStatus: 'AVAILABLE' | 'RESERVED' | 'DOCS_PENDING' =
    requested === 'RESERVED' || requested === 'DOCS_PENDING' ? requested : 'AVAILABLE';
  return { vehicle, signedPhotos, intendedStatus, draftOwner };
};

function parseFormToVehicleCreate(formData: FormData) {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const getOptional = (k: string) => {
    const v = get(k);
    return v === '' ? undefined : v;
  };
  return {
    brand: get('brand'),
    model: get('model'),
    year: get('year'),
    fuel: get('fuel'),
    mileage: get('mileage'),
    vin: get('vin').toUpperCase(),
    // The license plate is optional: schema preprocessing maps "" to undefined
    // so we only need to forward the raw value as-is. Backend Zod handles
    // canonicalization to "XX-XX-XX".
    licensePlate: getOptional('licensePlate'),
    purchasePrice: get('purchasePrice'),
    salePrice: getOptional('salePrice'),
    status: get('status') || 'AVAILABLE',
    acquisitionDate: get('acquisitionDate'),
    description: getOptional('description'),
    pendingDocFlags: {
      financing: formData.get('pendingDocFlags.financing') === 'true',
      imt: formData.get('pendingDocFlags.imt') === 'true',
      registration: formData.get('pendingDocFlags.registration') === 'true',
      docs: formData.get('pendingDocFlags.docs') === 'true',
    },
  };
}

export const actions: Actions = {
  webPublication: (event) =>
    webPublicationAction(event, event.url.searchParams.get('viatura') ?? ''),
  submit: async (event) => {
    const formData = await event.request.formData();
    const raw = parseFormToVehicleCreate(formData);

    const parsed = vehicleCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos',
        issues: parsed.error.issues,
      });
    }

    try {
      const { id } = await vehiclesApi.create(event, { ...parsed.data, status: 'DRAFT' });
      redirect(303, crmPath(`/viaturas/nova?viatura=${id}&estado=${parsed.data.status}`));
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string } | null;
        const feedback = err.body as {
          field?: string;
          issues?: { path: (string | number)[]; message: string }[];
        } | null;
        return fail(err.status, {
          field: feedback?.field,
          issues: feedback?.issues,
          error: body?.error ?? 'Falha ao criar viatura.',
        });
      }
      throw err;
    }
  },
};
