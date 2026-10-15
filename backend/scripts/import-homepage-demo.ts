/** Explicit, repeatable import of the five former homepage examples. Never run as an automatic seed. */
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../src/db.js';
import { getSupabase, getBucketName } from '../src/lib/data/storage.js';
import { makePublicSlug } from '../src/lib/domain/publicVehicle.js';
import { highlightsKey, saveHighlights } from '../src/lib/server/homepageHighlights.js';
import { cars, photo } from '../../apps/website/src/lib/components/stand-concepts/data.js';

const marker = '[DEMONSTRAÇÃO HOMEPAGE]';
const vinFor = (index: number) => `ANMDEMA${String(index + 1).padStart(10, '0')}`;
if (!process.argv.includes('--apply')) {
  console.log(
    'Preview only: five demo records, one existing homepage photo each, no purchases or sales. Use --apply to import.',
  );
  await prisma.$disconnect();
} else {
  const uploaded: string[] = [];
  let committed = false;
  try {
    const previous = await prisma.appSetting.findUnique({ where: { key: highlightsKey } });
    const existing = await Promise.all(
      cars.map((_, index) => prisma.vehicle.findUnique({ where: { vin: vinFor(index) } })),
    );
    if (existing.some((row) => row && !row.description?.startsWith(marker)))
      throw new Error('Demo VIN collision: no changes made.');
    const demoIds = cars.map(
      (car, index) =>
        existing[index]?.id ??
        `c${createHash('sha256').update(`homepage-demo:${car.id}`).digest('hex').slice(0, 24)}`,
    );
    const prior = previous?.value as
      | { revision: string; items: { vehicleId: string }[] }
      | undefined;
    if (prior && prior.items.some((item) => !demoIds.includes(item.vehicleId)))
      throw new Error('Existing editorial selection found: import will not replace it.');
    const staged = [];
    for (const [index, car] of cars.entries()) {
      if (existing[index]) continue;
      const path = `${demoIds[index]}/${randomUUID()}.jpg`;
      const response = await fetch(photo(car.image, 1800), { signal: AbortSignal.timeout(30000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
        throw new Error(`Photo unavailable for ${car.brand}`);
      const image = Buffer.from(await response.arrayBuffer());
      if (image.length > 10 * 1024 * 1024) throw new Error('Photo exceeds upload limit');
      const { error } = await getSupabase()
        .storage.from(getBucketName())
        .upload(path, image, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error(`Photo storage failed for ${car.brand}`);
      uploaded.push(path);
      staged.push({ index, car, path });
    }
    const rows = await prisma.$transaction(async (tx) => {
      const records = [...existing];
      for (const { index, car, path } of staged) {
        const id = demoIds[index]!;
        records[index] = await tx.vehicle.create({
          data: {
            id,
            brand: car.brand,
            model: car.model,
            year: car.year,
            fuel:
              car.fuel === 'Diesel' ? 'DIESEL' : car.fuel === 'Elétrico' ? 'ELECTRIC' : 'GASOLINE',
            mileage: car.km,
            vin: vinFor(index),
            licensePlate: null,
            purchasePrice: '0',
            salePrice: String(car.price),
            status: 'AVAILABLE',
            acquisitionDate: new Date(),
            description: `${marker} Registo de teste pedido pelo proprietário. Dados ilustrativos do antigo header. VIN fictício. Custo de aquisição não fornecido (0 técnico). Não representa uma aquisição real.`,
            photos: [path],
            webPublished: true,
            publicSlug: makePublicSlug({ id, brand: car.brand, model: car.model, year: car.year }),
            publicPrice: String(car.price),
            publicDescription: `Viatura de demonstração — dados e fotografia ilustrativos. ${car.line} Informação usada para testar o carrossel e o CRM; não representa stock real confirmado.`,
            publicPhotoPaths: [path],
            publicTransmission: 'AUTOMATIC',
            publicSpecifications: { powerHp: car.power, category: car.category },
          },
        });
        await tx.activityLog.create({
          data: {
            type: 'VEHICLE_ADDED',
            entityType: 'vehicle',
            entityId: id,
            message: `Demonstração da homepage adicionada: ${car.brand} ${car.model}`,
            metadata: { source: 'homepage-demo-import' },
          },
        });
      }
      return records;
    });
    committed = true;
    await saveHighlights(
      prisma,
      {
        revision: prior?.revision ?? null,
        items: rows.map((row) => {
          if (!row?.publicPhotoPaths[0])
            throw new Error('Imported demo is missing its approved photo.');
          return { vehicleId: row.id, photoPath: row.publicPhotoPaths[0] };
        }),
      },
      null,
    );
    console.log(
      JSON.stringify({
        imported: staged.length,
        featured: rows.length,
        vehicles: rows.map((row) => ({
          brand: row!.brand,
          model: row!.model,
          photos: row!.photos.length,
        })),
      }),
    );
  } catch (error) {
    if (!committed && uploaded.length)
      await getSupabase().storage.from(getBucketName()).remove(uploaded);
    console.error(
      error instanceof Error
        ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[DATABASE_URL]')
        : 'Import failed',
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
