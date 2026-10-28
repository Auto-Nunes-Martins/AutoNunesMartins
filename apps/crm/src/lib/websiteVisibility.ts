import { isVehiclePhotoPath } from '../../../../shared/vehiclePhotoPrincipal.mjs';

export type WebsiteVehicle = {
  id: string; webPublished?: boolean; publicSlug?: string | null; publicPrice?: string | null;
  status: string; soldDate?: unknown; sale?: unknown; photos: string[];
};

/** Match the public query/DTO contract; photos are optional for a published listing. */
export function websiteVisibility(vehicle: WebsiteVehicle) {
  if (!vehicle.webPublished) {
    const blocked = !['AVAILABLE', 'RESERVED'].includes(vehicle.status) || !!vehicle.sale || !!vehicle.soldDate;
    return { visible: false, state: blocked ? 'blocked' : 'private', label: 'Não publicado', detail: vehicle.status === 'DRAFT' ? 'Rascunho: conclua a ficha antes de publicar.' : blocked ? 'Para publicar, a viatura deve estar Disponível ou Reservada, sem venda registada.' : 'Visível apenas no CRM.' };
  }
  if (!['AVAILABLE', 'RESERVED'].includes(vehicle.status) || vehicle.sale || vehicle.soldDate)
    return { visible: false, state: 'blocked', label: 'Publicação oculta', detail: 'A viatura está vendida ou num estado que impede a apresentação no website.' };
  if (!vehicle.publicSlug || (vehicle.publicPrice != null && !(Number(vehicle.publicPrice) > 0)))
    return { visible: false, state: 'blocked', label: 'Publicação indisponível', detail: 'A publicação está assinalada, mas falta um endereço público válido ou um preço válido.' };
  const hasPhotos = vehicle.photos.some(path => isVehiclePhotoPath(vehicle.id, path));
  return { visible: true, state: 'live', label: hasPhotos ? 'Publicado no website' : 'Publicado · sem fotografias', detail: hasPhotos ? 'Ficha visível no website público.' : 'Ficha visível no website com «Imagem indisponível».' };
}
