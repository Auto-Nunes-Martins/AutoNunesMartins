import { expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { publicVehicleDto } from './publicVehicle.js';

it('projects only approved photo positions in current order, without exposing private paths', () => {
  const id = 'c123456789012345678901234';
  const a = `${id}/12345678-1234-1234-1234-123456789abc.jpg`;
  const b = `${id}/12345678-1234-1234-1234-123456789abd.jpg`;
  const framing = { desktop: { x: 50, y: 80 }, mobile: { x: 40, y: 70 } };
  const row = {
    id,
    photos: [a, b],
    galleryFraming: { [b]: framing, 'foreign/private.jpg': framing },
    brand: 'Teste',
    model: 'Teste',
    year: 2026,
    fuel: 'DIESEL',
    mileage: 0,
    status: 'AVAILABLE',
    webPublished: true,
    publicSlug: 'teste-123456abcdef',
    publicPrice: new Prisma.Decimal(100),
    publicDescription: null,
    publicTransmission: null,
    publicSpecifications: {},
  };
  expect(publicVehicleDto(row as never).galleryFraming).toEqual([null, framing]);
  const reordered = publicVehicleDto({ ...row, photos: [b, a] } as never);
  expect(reordered.galleryFraming).toEqual([framing, null]);
  expect(JSON.stringify(reordered)).not.toContain(id + '/');
  expect(publicVehicleDto({ ...row, photos: [a] } as never)).not.toHaveProperty('galleryFraming');
});

it('migrates existing rows to an empty map without touching their photos', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `CREATE TABLE "Vehicle" (id TEXT PRIMARY KEY, photos TEXT[]); INSERT INTO "Vehicle" VALUES ('old', ARRAY['original.webp']);`,
    );
    await db.exec(
      await readFile(
        new URL(
          '../../../prisma/migrations/20261030110000_photo_framing/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const result = await db.query('SELECT photos, "galleryFraming" FROM "Vehicle"');
    expect(result.rows).toEqual([{ photos: ['original.webp'], galleryFraming: {} }]);
  } finally {
    await db.close();
  }
});
