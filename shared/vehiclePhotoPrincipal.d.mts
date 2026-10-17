export function orderedPublicPhotos(photos: readonly string[], approved: readonly string[]): string[];
export function isVehiclePhotoPath(id:string,path:string):boolean;
export function vehiclePrincipalPath(vehicle: { id?:string; photos: readonly string[]; publicPhotoPaths?: readonly string[]; webPublished?: boolean; status?: string; soldDate?: unknown; sale?: unknown }): string | undefined;
