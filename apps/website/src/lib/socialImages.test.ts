import { expect, it } from 'vitest';
import { vehicleSocialImage } from './socialImages';
import { publicVehicleSchema } from './publicVehicles';
const vehicle = {
  slug: 'bmw-serie-1-2019-012345abcdef',
  brand: 'BMW',
  model: 'Série 1',
  year: 2019,
  fuel: 'DIESEL',
  mileage: 75000,
  price: '21900.25',
  currency: 'EUR',
  description: null,
  transmission: null,
  availability: 'AVAILABLE',
  photos: ['/api/public/vehicles/bmw-serie-1-2019-012345abcdef/photos/0'],
};

it('uses versioned framed photos without inventing dimensions for an older API', () => {
  const version = 'a'.repeat(64);
  const result = vehicleSocialImage(
    publicVehicleSchema.parse({ ...vehicle, socialPhotoVersion: version }),
  );
  expect(result).toMatchObject({
    image: `/viaturas/${vehicle.slug}/social-image?v=${version}`,
    imageWidth: 1260,
    imageHeight: 900,
    imageType: 'image/jpeg',
    brandImage: false,
  });
  expect(vehicleSocialImage(publicVehicleSchema.parse(vehicle))).not.toHaveProperty('imageWidth');
  expect(vehicleSocialImage(publicVehicleSchema.parse({ ...vehicle, photos: [] }))).toEqual({});
  expect(
    vehicleSocialImage(publicVehicleSchema.parse({ ...vehicle, socialPhotoVersion: 'bad' })),
  ).not.toHaveProperty('imageWidth');
});
