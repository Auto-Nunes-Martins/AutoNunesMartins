import type { Fuel, VehicleStatus, DeliveryStatus } from '@anm/types';
import type { VehicleListParams } from '$lib/server/vehicles';
import type { SaleListParams } from '$lib/server/sales';
import type { CustomerListParams } from '$lib/server/customers';

const FUELS: Fuel[] = ['GASOLINE', 'DIESEL', 'HYBRID', 'PLUGIN_HYBRID', 'ELECTRIC', 'LPG'];
const STATUSES: VehicleStatus[] = [
  'DRAFT',
  'AVAILABLE',
  'RESERVED',
  'SOLD',
  'DELIVERED',
  'DOCS_PENDING',
  'RETURNED',
];

function pickFuel(value: string | null): Fuel | undefined {
  return value && (FUELS as string[]).includes(value) ? (value as Fuel) : undefined;
}
function pickStatus(value: string | null): VehicleStatus | undefined {
  return value && (STATUSES as string[]).includes(value) ? (value as VehicleStatus) : undefined;
}

export function vehiclesFilters(url: URL): VehicleListParams {
  const sp = url.searchParams;
  const params: VehicleListParams = {
    agedStock: sp.get('agedStock') === 'true' || undefined,
    brand: sp.get('brand') ?? undefined,
    model: sp.get('model') ?? undefined,
    fuel: pickFuel(sp.get('fuel')),
    status: pickStatus(sp.get('status')),
    yearMin: sp.get('yearMin') ? Number(sp.get('yearMin')) : undefined,
    yearMax: sp.get('yearMax') ? Number(sp.get('yearMax')) : undefined,
    mileageMin: sp.get('mileageMin') ? Number(sp.get('mileageMin')) : undefined,
    mileageMax: sp.get('mileageMax') ? Number(sp.get('mileageMax')) : undefined,
    q: sp.get('q') ?? undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    pageSize: 25,
    sortBy: (sp.get('sortBy') as VehicleListParams['sortBy']) ?? 'createdAt',
    sortDir: sp.get('sortDir') === 'asc' ? 'asc' : 'desc',
    // Drafts have a dedicated highlighted section above the main table,
    // so exclude them here to avoid duplicates. pickStatus no longer
    // returns DRAFT, so this notStatus filter is always active.
    notStatus: 'DRAFT',
  };
  return params;
}

const DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'SCHEDULED', 'DELIVERED'];

function pickDeliveryStatus(value: string | null): DeliveryStatus | undefined {
  return value && (DELIVERY_STATUSES as string[]).includes(value)
    ? (value as DeliveryStatus)
    : undefined;
}

export function salesFilters(url: URL): SaleListParams {
  const sp = url.searchParams;
  const params: SaleListParams = {
    q: sp.get('q') ?? undefined,
    deliveryStatus: pickDeliveryStatus(sp.get('deliveryStatus')),
    dateFrom: sp.get('dateFrom') ?? undefined,
    dateTo: sp.get('dateTo') ?? undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    pageSize: 25,
    sortBy: (sp.get('sortBy') as SaleListParams['sortBy']) ?? 'saleDate',
    sortDir: sp.get('sortDir') === 'asc' ? 'asc' : 'desc',
  };
  return params;
}

export function customersFilters(url: URL): CustomerListParams {
  const sp = url.searchParams;
  const params: CustomerListParams = {
    q: sp.get('q') ?? undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    pageSize: 25,
    sortBy: (sp.get('sortBy') as CustomerListParams['sortBy']) ?? 'createdAt',
    sortDir: sp.get('sortDir') === 'asc' ? 'asc' : 'desc',
  };
  return params;
}

