import {
  fuelLabels,
  publicMileage,
  formatVehiclePrice,
  type PublicVehicle,
} from './publicVehicles';

/** Distinguish real stock using only facts already visible on its public detail page. */
export function vehicleSeo(vehicle: PublicVehicle) {
  const name = `${vehicle.brand} ${vehicle.model}`;
  const mileage =
    vehicle.mileage === null ? 'quilometragem: Sob consulta' : publicMileage(vehicle.mileage);
  const price = formatVehiclePrice(vehicle.price);
  const summary = `${price} · ${vehicle.year} · ${mileage} · ${fuelLabels[vehicle.fuel]}.${vehicle.availability === 'RESERVED' ? ' Reservada.' : ''}`;
  return {
    title: `${name}${vehicle.price ? ` — ${price}` : ` (${vehicle.year})`} — Auto Nunes Martins`,
    description: `${summary} Veja as fotografias e fale connosco para marcar uma visita.`,
  };
}
