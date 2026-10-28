import type { PrismaClient } from '@prisma/client';
import { licensePlatePtSchema } from '@anm/types';
type Event = { type: string; entityType: string; entityId: string; message: string; metadata?: unknown };
type Vehicle = { brand: string; model: string; year?: number; licensePlate?: string | null };
function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function activityVehicleLabel(vehicle: Vehicle) {
  const plate = vehicle.licensePlate ? licensePlatePtSchema.safeParse(vehicle.licensePlate) : null;
  return `${vehicle.brand} ${vehicle.model}${vehicle.licensePlate ? ' · ' + (plate?.success ? plate.data : vehicle.licensePlate) : vehicle.year ? ' · ' + vehicle.year : ''}`;
}
export function activityAction(row: Event): string | undefined {
  const meta = object(row.metadata);
  if (row.type !== 'VEHICLE_UPDATED') return;
  if (typeof meta.webPublished === 'boolean') return meta.webPublished ? 'website-enabled' : 'website-disabled';
  if (row.entityId === 'homepageHighlights' || meta.setting === 'homepageHighlights') return 'homepage-highlights';
  if (meta.setting === 'featuredVehicleId') return meta.value === null ? 'dashboard-highlight-removed' : 'dashboard-highlight-set';
}
export async function contextualActivity(db: Pick<PrismaClient, 'vehicle'>, rows: Event[]) {
  const ids = [...new Set(rows.filter(row => row.entityType === 'vehicle' && row.entityId && !['homepageHighlights', '-'].includes(row.entityId)).map(row => row.entityId))];
  const vehicles = ids.length ? await db.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, brand: true, model: true, year: true, licensePlate: true } }) : [];
  const byId = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
  return rows.map(row => {
    const semanticAction = activityAction(row);
    if (row.entityType !== 'vehicle' || row.entityId === 'homepageHighlights' || row.entityId === '-') return { semanticAction };
    const current = byId.get(row.entityId), snapshot = object(object(row.metadata).vehicle);
    const recorded = typeof snapshot.brand === 'string' && typeof snapshot.model === 'string'
      ? { brand: snapshot.brand, model: snapshot.model, year: typeof snapshot.year === 'number' ? snapshot.year : undefined, licensePlate: typeof snapshot.licensePlate === 'string' ? snapshot.licensePlate : null } : null;
    const label = recorded ? activityVehicleLabel(recorded) : current ? activityVehicleLabel(current) : null;
    return {
      semanticAction, entityAvailable: !!current,
      entityContext: label && row.message.includes(label) ? undefined : { label, source: recorded ? 'recorded' as const : current ? 'current' as const : 'unavailable' as const },
    };
  });
}
