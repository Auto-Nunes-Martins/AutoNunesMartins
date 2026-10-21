declare global {
  namespace App { interface Error { message: string; unavailableVehicle?: import('$lib/unavailableVehicle').UnavailableVehicle } }
}
export {};
