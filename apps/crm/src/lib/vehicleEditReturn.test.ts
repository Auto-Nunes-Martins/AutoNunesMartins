import { describe, expect, it, vi } from 'vitest';
vi.mock('$app/paths', () => ({ base: '/crm' }));
import { vehicleEditReturn } from './vehicleEditReturn';

const current = new URL('https://example.test/crm/viaturas/car1/editar');
const fallback = '/crm/viaturas/car1';
describe('vehicle edit return destination', () => {
  it.each(['/crm/viaturas/car1', '/crm/viaturas?q=BMW&page=3&status=AVAILABLE#resultados', '/crm/dashboard'])('keeps internal GET origin %s', path => {
    expect(vehicleEditReturn('car1', current, new URL(path, current))).toBe(path);
  });
  it.each(['https://evil.test/crm/viaturas', '//evil.test/crm/viaturas', '/viaturas', '/crm-other/viaturas', '/crm/viaturas/car1/editar', '/crm/viaturas/car1/editar?/submit', '/crm/viaturas?/delete', '/crm/viaturas/nova', '/crm/api/viaturas', '/crm/viaturas/%2fexternal', '/crm//evil.test'])('rejects unsafe or editing origin %s', path => {
    expect(vehicleEditReturn('car1', current, new URL(path, current))).toBe(fallback);
  });
  it('uses the detail fallback for direct links and reloads without an origin', () => {
    expect(vehicleEditReturn('car1', current)).toBe(fallback);
  });
});
