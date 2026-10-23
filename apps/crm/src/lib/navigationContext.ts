/** Deterministic internal parents. Never depends on external browser history. */
export function contextualParent(path: string): { href: string; label: string } | null {
  const parts = path.split('/').filter(Boolean);
  const section = parts[0];
  if (path === '/viaturas/nova') return null;
  if (section === 'site' && parts.length > 1)
    return { href: '/dashboard', label: 'Voltar ao Dashboard' };
  const names: Record<string, string> = {
    viaturas: 'viaturas',
    clientes: 'clientes',
    tarefas: 'tarefas',
    vendas: 'vendas',
  };
  if (!section || !names[section] || parts.length < 2) return null;
  // Tasks are edited directly from the board; /tarefas/:id has no detail page.
  if (section === 'tarefas') return { href: '/tarefas', label: 'Voltar a tarefas' };
  if (section === 'viaturas' && parts[2] === 'editar') return null; // The unified editor owns its guarded return.
  if (parts.length >= 3)
    return {
      href: `/${section}/${parts[1]}`,
      label: `Voltar à ficha ${section === 'viaturas' ? 'da viatura' : section === 'clientes' ? 'do cliente' : section === 'vendas' ? 'da venda' : 'da tarefa'}`,
    };
  return { href: `/${section}`, label: `Voltar a ${names[section]}` };
}

/** Only list contexts, kept in memory by the authenticated layout. */
export function listContext(path: string, search: string) {
  return /^\/(viaturas|clientes|tarefas|vendas)$/.test(path)
    ? { section: path.slice(1), href: path + search }
    : null;
}
