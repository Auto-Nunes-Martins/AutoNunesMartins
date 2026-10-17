/** Approval is membership, never an independent cover/order. No storage or framework dependencies. */
export function orderedPublicPhotos(photos, approved) {
  return [...new Set(photos)].filter(path => approved.includes(path));
}
export function isVehiclePhotoPath(id,path){return /^c[a-z0-9]{24}$/.test(id)&&new RegExp(`^${id}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.(?:jpg|jpeg|png|webp)$`).test(path);}
export function vehiclePrincipalPath(vehicle) {
  const publicListing = vehicle.webPublished && (!vehicle.status || ['AVAILABLE', 'RESERVED'].includes(vehicle.status)) && !vehicle.soldDate && !vehicle.sale;
  return publicListing ? orderedPublicPhotos(vehicle.photos, vehicle.publicPhotoPaths ?? []).find(path=>!vehicle.id||isVehiclePhotoPath(vehicle.id,path)) : vehicle.photos[0];
}
