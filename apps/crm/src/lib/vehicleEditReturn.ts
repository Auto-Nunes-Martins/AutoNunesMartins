import { crmPath, crmRoute } from '$lib/paths';

/** Only CRM GET pages can be destinations; never replay an action or another editor. */
export function vehicleEditReturn(vehicleId: string, current: URL, previous?: URL | null): string {
  const fallback = crmPath(`/viaturas/${vehicleId}`);
  if (!previous || previous.origin !== current.origin) return fallback;
  const route = crmRoute(previous.pathname);
  if (!route.startsWith('/') || route.startsWith('//') || /[\\%]/.test(route)
    || crmPath(route) !== previous.pathname) return fallback;
  const list = /^\/(viaturas|clientes|tarefas|vendas|atividade)$/.test(route);
  const detail = /^\/(viaturas|clientes|vendas)\/[a-zA-Z0-9_-]+$/.test(route)
    && !/\/(nova|novo)$/.test(route);
  if (!list && !detail && !/^\/(dashboard|definicoes|site\/destaques)$/.test(route)) return fallback;
  if ([...previous.searchParams.keys()].some(key => key.startsWith('/'))) return fallback;
  return previous.pathname + previous.search + previous.hash;
}
