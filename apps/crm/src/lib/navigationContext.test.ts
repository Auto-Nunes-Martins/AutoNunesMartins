import { describe, expect, it } from 'vitest';
import { contextualParent, listContext } from './navigationContext';
describe('safe contextual return', () => {
  it('returns detail/create pages to their actual internal parent', () => {
    expect(contextualParent('/viaturas/nova')?.href).toBe('/viaturas');
    expect(contextualParent('/clientes/c1/editar')?.href).toBe('/clientes/c1');
    expect(contextualParent('/tarefas/c1')?.href).toBe('/tarefas');
    expect(contextualParent('/site/destaques')?.href).toBe('/dashboard');
  });
  it('never derives a destination from external history or an unknown collection', () => {
    expect(contextualParent('/https://external.invalid')).toBeNull();
    expect(contextualParent('/dashboard')).toBeNull();
    expect(contextualParent('/viaturas/c1/editar')).toBeNull();
  });
  it('preserves only genuine list URLs for the authenticated in-memory context', () => {
    expect(listContext('/viaturas', '?status=AVAILABLE&page=2')?.href).toBe('/viaturas?status=AVAILABLE&page=2');
    expect(listContext('/viaturas/c1', '?x=1')).toBeNull();
  });
});
