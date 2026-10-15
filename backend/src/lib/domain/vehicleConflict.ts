export function duplicateVehicleFeedback(error: unknown) {
  const target = (error as { meta?: { target?: unknown } })?.meta?.target;
  const constraint = String(target ?? '').toLowerCase();
  if (constraint.includes('licenseplate') || constraint.includes('license_plate')) {
    return { error: 'Já existe uma viatura com esta matrícula.', field: 'licensePlate' };
  }
  if (constraint.includes('vin'))
    return { error: 'Já existe uma viatura com este VIN.', field: 'vin' };
  return { error: 'Já existe uma viatura com estes dados. Confirme o VIN e a matrícula.' };
}
