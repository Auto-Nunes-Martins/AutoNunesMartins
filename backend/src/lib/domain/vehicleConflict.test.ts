import { expect, it } from 'vitest';
import { duplicateVehicleFeedback } from './vehicleConflict.js';
it('identifies a duplicate plate instead of incorrectly blaming the VIN', () => {
  expect(duplicateVehicleFeedback({ meta: { target: ['licensePlate'] } })).toMatchObject({
    field: 'licensePlate',
  });
  expect(duplicateVehicleFeedback({ meta: { target: 'Vehicle_vin_key' } })).toMatchObject({
    field: 'vin',
  });
  expect(duplicateVehicleFeedback({})).not.toHaveProperty('field');
});
