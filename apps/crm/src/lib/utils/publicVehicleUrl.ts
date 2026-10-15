export function publicVehicleUrl(websiteUrl: string, slug: string): string {
  return `${websiteUrl.replace(/\/+$/, '')}/viaturas/${encodeURIComponent(slug)}`;
}
