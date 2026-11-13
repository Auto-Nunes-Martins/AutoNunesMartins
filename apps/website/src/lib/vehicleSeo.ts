import { fuelLabels, publicMileage, formatVehiclePrice, type PublicVehicle } from './publicVehicles';

/** Distinguish real stock using only facts already visible on its public detail page. */
export function vehicleSeo(vehicle: PublicVehicle) {
  const name = `${vehicle.brand} ${vehicle.model}`;
  const mileage = vehicle.mileage === null ? 'quilometragem: Sob consulta' : publicMileage(vehicle.mileage);
  const summary = `${name} de ${vehicle.year}, ${fuelLabels[vehicle.fuel]}, ${mileage}. ${formatVehiclePrice(vehicle.price)}.${vehicle.availability === 'RESERVED' ? ' Reservada.' : ''}`;
  return {
    title: `${name} (${vehicle.year}) — Auto Nunes Martins`,
    description: `${summary} Consulte os detalhes na Auto Nunes Martins.`,
  };
}
