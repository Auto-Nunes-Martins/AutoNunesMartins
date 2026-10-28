import { crmPath } from '$lib/paths';

/** Deleted entities have no detail destination. Keep their audit record as readable text. */
export function activityHref(row: {
  type: string;
  entityType: string;
  entityId: string;
  entityAvailable?: boolean;
  semanticAction?: string;
}): string | null {
  if (row.semanticAction === 'homepage-highlights') return crmPath('/site/destaques');
  if (row.semanticAction?.startsWith('dashboard-highlight-')) return crmPath('/dashboard');
  if (row.entityAvailable === false) return null;
  if (!row.entityId || row.type === 'VEHICLE_DELETED') return null;
  switch (row.entityType) {
    case 'vehicle':
      return crmPath(`/viaturas/${row.entityId}`);
    case 'sale':
      return crmPath(`/vendas/${row.entityId}`);
    case 'customer':
      return crmPath(`/clientes/${row.entityId}`);
    case 'task':
      return crmPath(`/tarefas/${row.entityId}/editar`);
    default:
      return null;
  }
}
