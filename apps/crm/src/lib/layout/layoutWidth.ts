/** Workspaces with simultaneous panels keep the full available width. */
export function usesFullCrmWidth(pathname: string): boolean {
  return (
    /^\/(dashboard|tarefas|financeiro)\/?$/.test(pathname) ||
    /^\/viaturas\/[^/]+\/vender\/?$/.test(pathname) ||
    (/^\/vendas\/[^/]+\/?$/.test(pathname) && !/^\/vendas\/anuladas\/?$/.test(pathname))
  );
}
