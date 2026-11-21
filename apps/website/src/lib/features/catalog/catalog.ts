export const sortOptions = {
  relevancia: 'Últimas entradas',
  preco_asc: 'Preço menor',
  preco_desc: 'Preço maior',
  desconto_desc: 'Maior desconto',
  ano: 'Ano mais recente',
  km: 'Quilometragem menor',
} as const;

export function catalogUrl(params: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(params);
  const clean = value.trim();
  if (clean && !(key === 'ordem' && clean === 'relevancia')) next.set(key, clean);
  else next.delete(key);
  if (key !== 'pagina') next.delete('pagina');
  if (key === 'marca' || !next.get('marca')) next.delete('modelo');
  const query = next.toString();
  return `/viaturas${query ? `?${query}` : ''}`;
}
