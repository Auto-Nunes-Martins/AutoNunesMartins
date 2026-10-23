import { vehicleCreateSchema } from '@anm/types';
import { serverEditIssues } from '$lib/forms/vehicleEditErrors';

export type CreationAction = 'draft' | 'crm' | 'publish';
export const internalVehicleFields = new Set([
  'brand',
  'model',
  'year',
  'fuel',
  'mileage',
  'vin',
  'licensePlate',
  'purchasePrice',
  'salePrice',
  'status',
  'acquisitionDate',
  'description',
]);

export function vehicleDetailsFromForm(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? '');
  return {
    brand: get('brand'),
    model: get('model'),
    year: get('year'),
    fuel: get('fuel'),
    mileage: get('mileage'),
    vin: get('vin').toUpperCase(),
    licensePlate: get('licensePlate') || null,
    purchasePrice: get('purchasePrice'),
    ...(get('salePrice') ? { salePrice: get('salePrice') } : {}),
    status: get('status'),
    acquisitionDate: get('acquisitionDate'),
    description: get('description'),
    pendingDocFlags: Object.fromEntries(
      ['financing', 'imt', 'registration', 'docs'].map((key) => [
        key,
        form.get('pendingDocFlags.' + key) === 'true',
      ]),
    ),
  };
}

export function creationDetailsIssues(data: ReturnType<typeof vehicleDetailsFromForm>) {
  const result = vehicleCreateSchema.safeParse({
    ...data,
    licensePlate: data.licensePlate ?? undefined,
  });
  return result.success
    ? []
    : serverEditIssues({
        issues: result.error.issues.map((issue) => ({
          path: ['data', ...issue.path],
          message: issue.message,
        })),
      });
}

export function creationStatus(action: CreationAction, intendedStatus: string) {
  return action === 'draft' ? 'DRAFT' : intendedStatus;
}
