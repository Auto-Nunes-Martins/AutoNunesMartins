import { registeredBrand } from '@anm/types';
import { publicPhoto, type PublicVehicle } from './publicVehicles';

export const homepageDescription =
  'Encontre o seu próximo carro na Auto Nunes Martins. Explore as viaturas disponíveis e fale connosco para marcar uma visita.';
export const homepageSocialImage = '/images/social/homepage-v2.jpg';
export function vehicleSocialImage(vehicle: PublicVehicle) {
  if (!vehicle.photos.length) return {};
  const version = vehicle.socialPhotoVersion;
  return {
    image: version
      ? `/viaturas/${vehicle.slug}/social-image?v=${version}`
      : publicPhoto(vehicle, 0),
    imageAlt: `${vehicle.brand} ${vehicle.model} (${vehicle.year}) — fotografia principal`,
    brandImage: false,
    // Old API deployments continue to serve their original, unknown-size photo.
    ...(version ? { imageType: 'image/jpeg', imageWidth: 1260, imageHeight: 900 } : {}),
  };
}
export function catalogSocialImage(brand: string) {
  const name = brand && registeredBrand(brand)?.name;
  return `/images/social/catalog-v1.jpg${name ? `?${new URLSearchParams({ marca: name })}` : ''}`;
}
