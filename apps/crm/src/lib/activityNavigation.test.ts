import { describe, expect, it } from 'vitest';
import { activityHref } from './activityNavigation';

describe('activity detail navigation', () => {
  it('retains the correct detail destination, including cancelled sales', () => {
    expect(activityHref({ type: 'VEHICLE_ADDED', entityType: 'vehicle', entityId: 'car' })).toBe(
      '/viaturas/car',
    );
    expect(activityHref({ type: 'SALE_CANCELLED', entityType: 'sale', entityId: 'sale' })).toBe(
      '/vendas/sale',
    );
    expect(
      activityHref({ type: 'CUSTOMER_UPDATED', entityType: 'customer', entityId: 'client' }),
    ).toBe('/clientes/client');
    expect(activityHref({ type: 'TASK_COMPLETED', entityType: 'task', entityId: 'task' })).toBe(
      '/tarefas/task/editar',
    );
  });
  it('keeps known deleted or non-navigable records readable without broken links', () => {
    expect(
      activityHref({ type: 'VEHICLE_DELETED', entityType: 'vehicle', entityId: 'deleted' }),
    ).toBeNull();
    expect(
      activityHref({ type: 'EXPENSE_ADDED', entityType: 'expense', entityId: 'expense' }),
    ).toBeNull();
    expect(
      activityHref({ type: 'VEHICLE_UPDATED', entityType: 'vehicle', entityId: '' }),
    ).toBeNull();
  });
});
