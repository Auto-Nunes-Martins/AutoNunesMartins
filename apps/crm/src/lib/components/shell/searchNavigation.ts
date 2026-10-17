export type SearchHit = { id: string; primary: string; secondary: string | null; href: string };
export const searchShortcuts: SearchHit[] = [
  { id: 'stock', primary: 'Viaturas', secondary: 'Consultar o stock', href: '/viaturas' },
  { id: 'new-vehicle', primary: 'Adicionar viatura', secondary: 'Nova entrada no inventário', href: '/viaturas/nova' },
  { id: 'tasks', primary: 'Tarefas', secondary: 'Consultar e organizar trabalho', href: '/tarefas' },
  { id: 'customers', primary: 'Clientes', secondary: 'Abrir a lista de clientes', href: '/clientes' },
  { id: 'sales', primary: 'Vendas', secondary: 'Consultar vendas registadas', href: '/vendas' },
];
export function safeSearchHit(hit: SearchHit) {
  return /^\/(?:viaturas|clientes|tarefas|vendas)(?:[/?#]|$)/.test(hit.href) && !hit.href.includes('\\');
}
export function rememberSearchHit(recent: SearchHit[], hit: SearchHit) {
  return safeSearchHit(hit) ? [hit, ...recent.filter(item => item.href !== hit.href)].slice(0, 6) : recent;
}
