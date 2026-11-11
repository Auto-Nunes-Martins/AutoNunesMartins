import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { publicSpecificationsSchema, galleryFramingSchema } from '@anm/types';
import { orderedPublicPhotos } from '../../../../shared/vehiclePhotoPrincipal.mjs';
import { isApprovedPhotoPath, type PublicVehicleQuery } from '../domain/publicVehicle.js';
import {
  currentCampaign,
  eligibleCampaign,
  readCampaigns,
  type SavedCampaign,
} from './campaignPricing.js';

// Never reuse the CRM's Vehicle select, filter builder, or serializer here.
export const publicVehicleSelect = {
  id: true,
  brand: true,
  model: true,
  year: true,
  fuel: true,
  mileage: true,
  status: true,
  webPublished: true,
  publicSlug: true,
  publicPrice: true,
  publicDescription: true,
  publicTransmission: true,
  publicSpecifications: true,
  photos: true,
  galleryFraming: true,
} satisfies Prisma.VehicleSelect;
type PublicRow = Prisma.VehicleGetPayload<{ select: typeof publicVehicleSelect }>;

export function publicVehicleWhere(query?: PublicVehicleQuery): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {
    webPublished: true,
    publicSlug: { not: null },
    status: { in: ['AVAILABLE', 'RESERVED'] },
    soldDate: null,
    sale: { is: null },
  };
  if (!query) return where;
  if (query.marca) where.brand = { equals: query.marca, mode: 'insensitive' };
  if (query.modelo) where.model = { equals: query.modelo, mode: 'insensitive' };
  if (query.combustivel) where.fuel = query.combustivel;
  if (query.transmissao) where.publicTransmission = query.transmissao;
  if (query.ano_min !== undefined || query.ano_max !== undefined) {
    where.year = { gte: query.ano_min, lte: query.ano_max };
  }
  if (query.km_min !== undefined || query.km_max !== undefined) {
    where.mileage = { gte: query.km_min, lte: query.km_max };
  }
  if (query.preco_min !== undefined || query.preco_max !== undefined) {
    where.publicPrice = { gt: 0, gte: query.preco_min, lte: query.preco_max };
  }
  if (query.q) {
    // PostgreSQL LIKE treats %/_ as wildcards; public search treats them literally.
    const q = query.q.replace(/[\\%_]/g, '\\$&');
    where.OR = [
      { brand: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { publicDescription: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function publicVehicleOrder(
  order: PublicVehicleQuery['ordem'],
): Prisma.VehicleOrderByWithRelationInput[] {
  // Homepage and catalog share stock-arrival order. Dates stay outside the public DTO.
  if (order === 'relevancia')
    return [{ acquisitionDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
  const orders: Record<
    Exclude<typeof order, 'relevancia'>,
    Prisma.VehicleOrderByWithRelationInput
  > = {
    preco_asc: { publicPrice: { sort: 'asc', nulls: 'last' } },
    preco_desc: { publicPrice: { sort: 'desc', nulls: 'last' } },
    ano: { year: 'desc' },
    km: { mileage: { sort: 'asc', nulls: 'last' } },
  };
  return [orders[order], { id: 'asc' }];
}

export function approvedPaths(row: Pick<PublicRow, 'id' | 'photos'>): string[] {
  return orderedPublicPhotos(row.photos)
    .filter((path) => isApprovedPhotoPath(row.id, path))
    .slice(0, 20);
}

/** Explicit JSON allowlist, even if a future query accidentally over-selects. */
export function publicVehicleDto(row: PublicRow, promotion?: SavedCampaign) {
  const framing = galleryFramingSchema.safeParse(row.galleryFraming).data ?? {};
  const positions = approvedPaths(row).map((path) => framing[path] ?? null);
  if (
    !row.webPublished ||
    !row.publicSlug ||
    (row.publicPrice !== null && !row.publicPrice.gt(0)) ||
    (row.status !== 'AVAILABLE' && row.status !== 'RESERVED')
  ) {
    throw new Error('Invalid public vehicle projection');
  }
  return {
    slug: row.publicSlug,
    ...(positions.some(Boolean) ? { galleryFraming: positions } : {}),
    brand: row.brand,
    model: row.model,
    year: row.year,
    fuel: row.fuel,
    mileage: row.mileage,
    price: promotion?.price ?? row.publicPrice?.toFixed(2) ?? null,
    ...(promotion
      ? {
          promotion: {
            referencePrice: promotion.referencePrice,
            startsAt: promotion.startsAt,
            endsAt: promotion.endsAt,
          },
        }
      : {}),
    currency: 'EUR' as const,
    description: row.publicDescription,
    transmission: row.publicTransmission,
    specifications: publicSpecificationsSchema.safeParse(row.publicSpecifications ?? {}).data ?? {},
    availability: row.status,
    // Immutable upload identities invalidate browser cache after replacement/reorder.
    // Storage paths/tokens stay private; every request reaching the server checks approval.
    photos: approvedPaths(row).map(
      (path, index) =>
        `/api/public/vehicles/${row.publicSlug}/photos/${index}?v=${publicPhotoVersion(path)}`,
    ),
  };
}

async function activePrices(tx: Prisma.TransactionClient, now: number) {
  const { items } = await readCampaigns(tx);
  const live = items.filter((item) => currentCampaign(item, now));
  if (!live.length) return new Map<string, SavedCampaign>();
  const rows = await tx.vehicle.findMany({
    where: {
      ...publicVehicleWhere(),
      status: 'AVAILABLE',
      id: { in: live.map(({ vehicleId }) => vehicleId) },
    },
    select: { id: true, status: true, publicPrice: true },
  });
  const prices = new Map<string, SavedCampaign>();
  for (const item of live) {
    const row = rows.find(({ id }) => id === item.vehicleId);
    const promotion = row && eligibleCampaign(row, live, now);
    if (promotion) prices.set(item.vehicleId, promotion);
  }
  return prices;
}

type CampaignPrices = Awaited<ReturnType<typeof activePrices>>;

function pricedWhere(query: PublicVehicleQuery, prices: CampaignPrices): Prisma.VehicleWhereInput {
  const where = publicVehicleWhere(query);
  if (!prices.size || !where.publicPrice) return where;
  const base = where.publicPrice;
  delete where.publicPrice;
  const ids = [...prices]
    .filter(
      ([, { price }]) =>
        Number(price) >= (query.preco_min ?? 0) && Number(price) <= (query.preco_max ?? Infinity),
    )
    .map(([id]) => id);
  where.AND = [
    { OR: [{ id: { notIn: [...prices.keys()] }, publicPrice: base }, { id: { in: ids } }] },
  ];
  return where;
}

function priceFor(row: PublicRow, prices: CampaignPrices) {
  const campaign = prices.get(row.id);
  return campaign ? new Prisma.Decimal(campaign.price) : row.publicPrice;
}

async function pricedPage(
  tx: Prisma.TransactionClient,
  query: PublicVehicleQuery,
  prices: CampaignPrices,
) {
  const where = pricedWhere(query, prices);
  const skip = (query.pagina - 1) * query.pageSize;
  const orderBy = publicVehicleOrder(query.ordem);
  if (!prices.size || (query.ordem !== 'preco_asc' && query.ordem !== 'preco_desc')) {
    return tx.vehicle.findMany({
      where,
      select: publicVehicleSelect,
      orderBy,
      skip,
      take: query.pageSize,
    });
  }
  // At most four insertions can move the boundary of the regular price page.
  const baseSkip = Math.max(0, skip - prices.size);
  const [base, promoted] = await Promise.all([
    tx.vehicle.findMany({
      where: { ...where, id: { notIn: [...prices.keys()] } },
      select: publicVehicleSelect,
      orderBy,
      skip: baseSkip,
      take: query.pageSize + prices.size,
    }),
    tx.vehicle.findMany({
      where: { ...where, id: { in: [...prices.keys()] } },
      select: publicVehicleSelect,
    }),
  ]);
  const direction = query.ordem === 'preco_asc' ? 1 : -1;
  return [...base, ...promoted]
    .sort((a, b) => {
      const left = priceFor(a, prices),
        right = priceFor(b, prices);
      const byPrice =
        left && right ? direction * left.comparedTo(right) : left ? -1 : right ? 1 : 0;
      return byPrice || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    })
    .slice(skip - baseSkip, skip - baseSkip + query.pageSize);
}

async function effectivePriceRange(
  tx: Prisma.TransactionClient,
  where: Prisma.VehicleWhereInput,
  prices: CampaignPrices,
) {
  const [base, matching] = await Promise.all([
    tx.vehicle.aggregate({
      where: { ...where, id: { notIn: [...prices.keys()] } },
      _min: { publicPrice: true },
      _max: { publicPrice: true },
    }),
    tx.vehicle.findMany({
      where: { ...where, id: { in: [...prices.keys()] } },
      select: { id: true },
    }),
  ]);
  const values = matching.map(({ id }) => Number(prices.get(id)!.price));
  return {
    min: values.length
      ? Math.min(...values, base._min.publicPrice?.toNumber() ?? Infinity).toFixed(2)
      : (base._min.publicPrice?.toFixed(2) ?? null),
    max: values.length
      ? Math.max(...values, base._max.publicPrice?.toNumber() ?? -Infinity).toFixed(2)
      : (base._max.publicPrice?.toFixed(2) ?? null),
  };
}

/** Brand navigation counts only available, published vehicles, without pagination. */
export async function listAvailablePublicBrands(db: PrismaClient) {
  const brands = await db.vehicle.groupBy({
    by: ['brand'],
    where: { ...publicVehicleWhere(), status: 'AVAILABLE' },
    _count: { _all: true },
    orderBy: { brand: 'asc' },
  });
  return brands.map((brand) => ({ value: brand.brand, count: brand._count._all }));
}

export async function listPublicVehicles(db: PrismaClient, query: PublicVehicleQuery) {
  return db.$transaction(
    async (tx) => {
      const prices = await activePrices(tx, Date.now());
      const where = pricedWhere(query, prices);
      const [rows, total, brands, models, fuels, transmissions, ranges, priceRange] =
        await Promise.all([
          pricedPage(tx, query, prices),
          tx.vehicle.count({ where }),
          tx.vehicle.groupBy({
            by: ['brand'],
            where: pricedWhere({ ...query, marca: undefined, modelo: undefined }, prices),
            _count: { _all: true },
            orderBy: { brand: 'asc' },
            take: 100,
          }),
          tx.vehicle.groupBy({
            by: ['brand', 'model'],
            where: pricedWhere({ ...query, modelo: undefined }, prices),
            _count: { _all: true },
            orderBy: [{ brand: 'asc' }, { model: 'asc' }],
            take: 100,
          }),
          tx.vehicle.groupBy({
            by: ['fuel'],
            where: pricedWhere({ ...query, combustivel: undefined }, prices),
            _count: { _all: true },
            orderBy: { fuel: 'asc' },
          }),
          tx.vehicle.groupBy({
            by: ['publicTransmission'],
            where: pricedWhere({ ...query, transmissao: undefined }, prices),
            _count: { _all: true },
            orderBy: { publicTransmission: 'asc' },
          }),
          tx.vehicle.aggregate({
            where,
            _min: { year: true, mileage: true, publicPrice: true },
            _max: { year: true, mileage: true, publicPrice: true },
          }),
          prices.size ? effectivePriceRange(tx, where, prices) : undefined,
        ]);
      return {
        items: rows.map((row) => publicVehicleDto(row, prices.get(row.id))),
        total,
        page: query.pagina,
        pageSize: query.pageSize,
        totalPages: Math.ceil(total / query.pageSize),
        facets: {
          brands: brands.map((v) => ({ value: v.brand, count: v._count._all })),
          models: models.map((v) => ({ brand: v.brand, value: v.model, count: v._count._all })),
          fuels: fuels.map((v) => ({ value: v.fuel, count: v._count._all })),
          transmissions: transmissions
            .filter((v) => v.publicTransmission !== null)
            .map((v) => ({ value: v.publicTransmission, count: v._count._all })),
          year: { min: ranges._min.year, max: ranges._max.year },
          mileage: { min: ranges._min.mileage, max: ranges._max.mileage },
          price: priceRange ?? {
            min: ranges._min.publicPrice?.toFixed(2) ?? null,
            max: ranges._max.publicPrice?.toFixed(2) ?? null,
          },
        },
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

export async function getPublicVehicle(
  db: PrismaClient,
  slug: string,
  preparePhotos?: (paths: string[]) => void,
) {
  const row = await db.vehicle.findFirst({
    where: { ...publicVehicleWhere(), publicSlug: slug },
    select: publicVehicleSelect,
  });
  if (!row) return null;
  const { items } = await readCampaigns(db);
  const vehicle = publicVehicleDto(row, eligibleCampaign(row, items, Date.now()));
  // Reuse this live public query; never expose private paths in the DTO and
  // never cache its authorization. Warming is optional and cannot fail the page.
  try {
    preparePhotos?.(approvedPaths(row));
  } catch {
    /* Best-effort pixels only. */
  }
  return vehicle;
}

/** The nearest five must be among the nearest five on either side of the price. */
export async function relatedPublicVehicles(db: PrismaClient, slug: string) {
  return db.$transaction(
    async (tx) => {
      const current = await tx.vehicle.findFirst({
        where: { ...publicVehicleWhere(), publicSlug: slug },
        select: publicVehicleSelect,
      });
      if (!current) return null;
      const prices = await activePrices(tx, Date.now());
      const price = priceFor(current, prices);
      if (!price || !price.isFinite() || !price.gt(0)) return [];
      const where = {
        ...publicVehicleWhere(),
        id: { not: current.id, ...(prices.size ? { notIn: [...prices.keys()] } : {}) },
      };
      const [below, above, promoted] = await Promise.all([
        tx.vehicle.findMany({
          where: { ...where, publicPrice: { gt: 0, lte: price } },
          select: publicVehicleSelect,
          orderBy: [{ publicPrice: 'desc' }, { publicSlug: 'asc' }],
          take: 5,
        }),
        tx.vehicle.findMany({
          where: { ...where, publicPrice: { gt: price } },
          select: publicVehicleSelect,
          orderBy: [{ publicPrice: 'asc' }, { publicSlug: 'asc' }],
          take: 5,
        }),
        prices.size
          ? tx.vehicle.findMany({
              where: { ...publicVehicleWhere(), id: { not: current.id, in: [...prices.keys()] } },
              select: publicVehicleSelect,
            })
          : [],
      ]);
      return [
        ...new Map(
          [...below, ...above, ...promoted]
            .filter(
              (row) =>
                row.id !== current.id && row.publicPrice?.isFinite() && row.publicPrice.gt(0),
            )
            .map((row) => [row.publicSlug, row]),
        ).values(),
      ]
        .sort(
          (a, b) =>
            priceFor(a, prices)!
              .minus(price)
              .abs()
              .comparedTo(priceFor(b, prices)!.minus(price).abs()) ||
            a.publicSlug!.localeCompare(b.publicSlug!),
        )
        .slice(0, 5)
        .map((row) => publicVehicleDto(row, prices.get(row.id)));
    },
    { isolationLevel: 'RepeatableRead' },
  );
}

const pendingPhotoAuthorizations = new WeakMap<
  PrismaClient,
  Map<string, Promise<string[] | null>>
>();
/** Share only a currently running query. Settled permissions are never cached.
 * Later requests (including another wave from the same gallery) query again.
 */
function currentPublicPhotoPaths(db: PrismaClient, slug: string): Promise<string[] | null> {
  let pending = pendingPhotoAuthorizations.get(db);
  if (!pending) {
    pending = new Map();
    pendingPhotoAuthorizations.set(db, pending);
  }
  const existing = pending.get(slug);
  if (existing) return existing;
  // Defer invocation so even a synchronous client failure runs cleanup after set().
  const request = Promise.resolve()
    .then(() =>
      db.vehicle.findFirst({
        where: { ...publicVehicleWhere(), publicSlug: slug },
        select: { id: true, photos: true },
      }),
    )
    .then((row) => (row ? approvedPaths(row) : null))
    .finally(() => {
      pending.delete(slug);
    });
  pending.set(slug, request);
  return request;
}

export async function getPublicPhotoPath(db: PrismaClient, slug: string, index: number) {
  const paths = await currentPublicPhotoPaths(db, slug);
  return paths?.[index] ?? null;
}

export const publicPhotoVersion = (path: string) => createHash('sha256').update(path).digest('hex');
/** One fresh, bounded query for a comparison; no retained vehicle/permission snapshot. */
export async function getPublicSelection(db: PrismaClient, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.vehicle.findMany({
    where: { ...publicVehicleWhere(), publicSlug: { in: ids } },
    select: publicVehicleSelect,
  });
  const { items } = await readCampaigns(db);
  const now = Date.now();
  return ids.map((id) => {
    const row = rows.find((row) => row.publicSlug === id);
    return row
      ? {
          id,
          status: 200,
          vehicle: publicVehicleDto(row, eligibleCampaign(row, items, now)),
          photoVersions: approvedPaths(row).map(publicPhotoVersion),
        }
      : { id, status: 404, vehicle: null };
  });
}

export async function listPublicCampaigns(db: PrismaClient) {
  return db.$transaction(
    async (tx) => {
      const prices = await activePrices(tx, Date.now());
      if (!prices.size) return [];
      const rows = await tx.vehicle.findMany({
        where: { ...publicVehicleWhere(), id: { in: [...prices.keys()] } },
        select: publicVehicleSelect,
      });
      return [...prices].flatMap(([id, promotion]) => {
        const row = rows.find((row) => row.id === id);
        return row ? [publicVehicleDto(row, promotion)] : [];
      });
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
/** Fresh permission snapshot for reusing already-downloaded public thumbnails, never Storage URLs. */
export async function getPublicPhotoVersions(db: PrismaClient, slug: string) {
  const paths = await currentPublicPhotoPaths(db, slug);
  return paths ? paths.map(publicPhotoVersion) : null;
}
