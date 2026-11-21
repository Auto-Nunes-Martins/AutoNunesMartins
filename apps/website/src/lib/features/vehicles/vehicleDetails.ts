import { catalogPlaceholder } from '$lib/localAssets';
import {
  fuelLabels,
  publicMileage,
  publicPhoto,
  transmissionLabels,
  type PublicVehicle,
} from '$lib/publicVehicles';

export function vehicleDetails(publicVehicle: PublicVehicle) {
  const car = {
    id: publicVehicle.slug,
    brand: publicVehicle.brand,
    model: publicVehicle.model,
    year: publicVehicle.year,
    km: publicVehicle.mileage,
    fuel: fuelLabels[publicVehicle.fuel],
    line: publicVehicle.availability === 'RESERVED' ? 'Reservada' : '',
    power: publicVehicle.specifications?.powerHp ?? 0,
    category: publicVehicle.specifications?.category ?? '',
    price: publicVehicle.price === null ? Number.NaN : Number(publicVehicle.price),
    image: publicVehicle.photos.length ? publicPhoto(publicVehicle, 0) : catalogPlaceholder,
  };
  const specs = [
    ['Marca', car.brand],
    ['Modelo', car.model],
    ['Ano', car.year],
    ['Quilometragem', publicMileage(car.km)],
    ...(car.power ? [['Potência', car.power + ' cv']] : []),
    ...(publicVehicle.transmission
      ? [['Caixa', transmissionLabels[publicVehicle.transmission]]]
      : []),
    ['Combustível', car.fuel],
    ...(car.category ? [['Categoria', car.category]] : []),
    ...(publicVehicle.specifications?.engineCc
      ? [['Cilindrada', publicVehicle.specifications.engineCc + ' cm³']]
      : []),
    ...(publicVehicle.specifications?.doors
      ? [['Portas', publicVehicle.specifications.doors]]
      : []),
    ...(publicVehicle.specifications?.seats
      ? [['Lugares', publicVehicle.specifications.seats]]
      : []),
    ...(publicVehicle.specifications?.color ? [['Cor', publicVehicle.specifications.color]] : []),
  ];
  return { car, specs };
}
