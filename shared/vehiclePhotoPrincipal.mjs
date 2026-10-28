/** All current vehicle photos follow global publication. Legacy subsets are ignored. */
export function orderedPublicPhotos(photos, _legacySubset) {
  return [...new Set(photos)];
}
export function isVehiclePhotoPath(id,path){return /^c[a-z0-9]{24}$/.test(id)&&new RegExp(`^${id}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.(?:jpg|jpeg|png|webp)$`).test(path);}
export function vehiclePrincipalPath(vehicle) {
  const publicListing = vehicle.webPublished && (!vehicle.status || ['AVAILABLE', 'RESERVED'].includes(vehicle.status)) && !vehicle.soldDate && !vehicle.sale;
  return publicListing ? orderedPublicPhotos(vehicle.photos).find(path=>!vehicle.id||isVehiclePhotoPath(vehicle.id,path)) : vehicle.photos[0];
}
