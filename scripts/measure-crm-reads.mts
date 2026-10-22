// Read-only diagnostic. Run with the backend environment loaded; never prints
// vehicle details, object paths, signed URLs or credentials.
import { prisma } from '../backend/src/db.js';
import { listVehicles } from '../backend/src/lib/data/vehicle.js';
import { signedThumbnails, signedPhotos, createSignedReadUrls, invalidateSignedReadUrl } from '../backend/src/lib/data/storage.js';
import { getVehicleWithProfit } from '../backend/src/lib/server/vehicleService.js';
import { readVariantManifest, forgetPhotoVariants, preferredVariantPath, variantPath, PHOTO_WIDTHS } from '../backend/src/lib/server/photoVariants.js';
import { vehiclePrincipalPath } from '../shared/vehiclePhotoPrincipal.mjs';

async function timed<T>(name: string, read: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await read();
  console.log(JSON.stringify({ stage: name, ms: Math.round(performance.now() - start) }));
  return result;
}

try {
  const list = await timed('list.database', () =>
    listVehicles(prisma, { pageSize: 25, notStatus: 'DRAFT' }),
  );
  const paths = list.items.map(vehiclePrincipalPath).filter((path): path is string => !!path);
  if (process.argv.includes('--compare')) {
    const reset = () => paths.forEach(path => {
      forgetPhotoVariants(path);
      for (const object of [path, ...PHOTO_WIDTHS.map(width => variantPath(path, width))]) invalidateSignedReadUrl(object);
    });
    const previousPipeline = async () => {
      const selected: string[] = [];
      for (let i = 0; i < paths.length; i += 4) {
        selected.push(...await Promise.all(paths.slice(i, i + 4).map(path => preferredVariantPath(path, 320))));
      }
      await createSignedReadUrls(selected);
      await createSignedReadUrls(paths);
    };
    for (let round = 1; round <= 3; round++) {
      // Alternate order to reduce connection warmup bias. Clear only this
      // diagnostic process's caches, never the running backend's caches.
      const reads = round % 2 ? ['previous', 'current'] : ['current', 'previous'];
      for (const read of reads) {
        reset();
        await timed(`list.coldComparison.${read}.${round}`, () => read === 'previous' ? previousPipeline() : signedThumbnails(paths));
      }
    }
    reset();
  }
  await timed('list.thumbnailsAndOriginals.cold', () => signedThumbnails(paths));
  await timed('list.thumbnailsAndOriginals.warm', () => signedThumbnails(paths));
  const manifests = await Promise.all(paths.map(readVariantManifest));
  console.log(
    JSON.stringify({
      rows: list.items.length,
      covers: paths.length,
      coversWithVariants: manifests.filter((m) => m?.variants.length).length,
    }),
  );
  const vehicle = list.items.find((item) => item.photos.length);
  if (vehicle) {
    await timed('detail.database', () => getVehicleWithProfit(vehicle.id));
    await timed('detail.gallery.cold', () => signedPhotos(vehicle.photos));
    await timed('detail.gallery.warm', () => signedPhotos(vehicle.photos));
    console.log(JSON.stringify({ galleryPhotos: vehicle.photos.length }));
  }
} catch {
  console.error('Read diagnostic failed; check backend connectivity and environment.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
