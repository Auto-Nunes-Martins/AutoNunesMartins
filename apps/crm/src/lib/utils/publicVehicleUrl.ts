import { websiteVisibility, type WebsiteVehicle } from '$lib/websiteVisibility';
export function publicVehicleUrl(websiteUrl: string, slug: string): string {
  return `${websiteUrl.replace(/\/+$/, '')}/viaturas/${encodeURIComponent(slug)}`;
}
/** Use the confirmed saved publication, never a draft ID or the requested operation. */
export function publishedVehicleUrl(websiteUrl:string, vehicle:WebsiteVehicle):string|undefined {
  return websiteVisibility(vehicle).visible && vehicle.publicSlug ? publicVehicleUrl(websiteUrl,vehicle.publicSlug) : undefined;
}
