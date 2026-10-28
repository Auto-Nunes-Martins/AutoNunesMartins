import { expect, it, vi } from 'vitest';
import { activityAction, activityVehicleLabel, contextualActivity } from './activityContext';
const event = { type: 'VEHICLE_UPDATED', entityType: 'vehicle', entityId: 'car', message: 'Publicação web desativada', metadata: { webPublished: false } };
it('classifies semantic icons from structured audit data, not message substrings', () => {
  expect(activityAction(event)).toBe('website-disabled');
  expect(activityAction({ ...event, metadata: { webPublished: true } })).toBe('website-enabled');
  expect(activityAction({ ...event, metadata: {}, entityId: 'homepageHighlights' })).toBe('homepage-highlights');
  expect(activityAction({ ...event, metadata: {} })).toBeUndefined();
});
it('formats plate context and preserves the original recorded identity after a rename/deletion', async () => {
  const db = { vehicle: { findMany: vi.fn().mockResolvedValue([]) } };
  const row = { ...event, metadata: { webPublished: false, vehicle: { brand: 'BMW', model: 'One', year: 2020, licensePlate: 'aa00aa' } } };
  const result = await contextualActivity(db as never, [row]);
  expect(result[0]).toMatchObject({ semanticAction: 'website-disabled', entityAvailable: false, entityContext: { source: 'recorded', label: 'BMW One · AA-00-AA' } });
  expect(row.message).toBe('Publicação web desativada');
  expect(activityVehicleLabel({ brand: 'BMW', model: 'One', year: 2020 })).toBe('BMW One · 2020');
});
it('labels old live-record lookup as current, batches it and never invents a missing identity', async () => {
  const findMany = vi.fn().mockResolvedValue([{ id: 'car', brand: 'Marca atual', model: 'Modelo atual', year: 2022, licensePlate: '12AB34' }]);
  const result = await contextualActivity({ vehicle: { findMany } } as never, [event, { ...event, entityId: 'missing' }]);
  expect(findMany).toHaveBeenCalledOnce();
  expect(result[0]?.entityContext).toEqual({ source: 'current', label: 'Marca atual Modelo atual · 12-AB-34' });
  expect(result[1]).toMatchObject({ entityAvailable: false, entityContext: { label: null, source: 'unavailable' } });
});
