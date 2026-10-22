import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { validatedReadCache } from './validatedReadCache.js';

type Scope = 'vehicles' | 'sales' | 'customers';
const dependencies = {
  vehicles: ['Vehicle'],
  sales: ['Sale', 'Vehicle', 'Customer', 'VehicleExpense', 'TradeIn'],
  customers: ['Customer', 'Sale'],
} as const;

export function crmListRevisionQuery(scope: Scope) {
  // Only hardcoded table names; no request content is interpolated as SQL.
  // Row versions detect inserts, edits and deletes committed by any session/process.
  const versions = dependencies[scope].map(table => Prisma.sql`
    SELECT ${table} || ':' || "id" || ':' || xmin::text AS version FROM ${Prisma.raw(`"${table}"`)}
  `);
  return Prisma.sql`SELECT md5(COALESCE(string_agg(version, ',' ORDER BY version), '')) AS revision
    FROM (${Prisma.join(versions, ' UNION ALL ')}) AS current_versions`;
}

const caches = Object.fromEntries((Object.keys(dependencies) as Scope[]).map(scope => [scope,
  validatedReadCache(async () => {
    // Returns only a digest. No names, NIFs, prices, IDs or tokens leave this query.
    const rows = await prisma.$queryRaw<{ revision: string }[]>(crmListRevisionQuery(scope));
    return rows[0]?.revision ?? null;
  }),
])) as Record<Scope, ReturnType<typeof validatedReadCache>>;

export function readCrmList<T>(scope: Scope, actor: { id: string; role: string } | undefined,
  params: Record<string, unknown>, load: () => Promise<T>) {
  // Keep exports/large pages out of the bounded navigation cache.
  if (!actor || Number(params.pageSize ?? 25) > 100) return load();
  return caches[scope].read(JSON.stringify([actor.id, actor.role, params]), load);
}
