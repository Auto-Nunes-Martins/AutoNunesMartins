import { expect, it } from 'vitest';
import { usesFullCrmWidth } from './layoutWidth';
it('preserves the width of the dashboard, task board and sales workspaces', () => {
  for (const path of [
    '/dashboard',
    '/tarefas',
    '/financeiro',
    '/viaturas/car/vender',
    '/vendas/sale',
  ])
    expect(usesFullCrmWidth(path)).toBe(true);
});
it('centres tables, vehicle details and editing pages using the public site width reference', () => {
  for (const path of [
    '/viaturas',
    '/viaturas/car',
    '/viaturas/car/editar',
    '/clientes',
    '/clientes/novo',
    '/vendas',
    '/vendas/anuladas',
    '/tarefas/nova',
    '/definicoes',
    '/site/destaques',
  ])
    expect(usesFullCrmWidth(path)).toBe(false);
});
