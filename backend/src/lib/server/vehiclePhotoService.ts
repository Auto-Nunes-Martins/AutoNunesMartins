import type { PrismaClient } from '@prisma/client';
import { cache } from '../data/cache.js';

export const MAX_PHOTOS = 20;
const MAX_ATTEMPTS = 3;

export class PhotoMutationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PhotoMutationError';
  }
}

type PhotoMutation =
  | { type: 'append'; path: string }
  | { type: 'remove'; path: string }
  | { type: 'reorder'; photos: string[] };

function conflict(): PhotoMutationError {
  return new PhotoMutationError(
    409,
    'As fotografias foram alteradas entretanto. Atualize a página e tente novamente.',
  );
}

/**
 * Compare-and-set on the ordered array prevents lost updates across processes.
 * Append/remove can be recomputed from current state; a reorder is client state
 * and must conflict rather than overwrite a concurrent change. No storage I/O
 * is performed here: the database change must succeed before deleting objects.
 */
export async function mutateVehiclePhotos(
  db: Pick<PrismaClient, 'vehicle' | '$transaction'>,
  vehicleId: string,
  mutation: PhotoMutation,
): Promise<{ photos: string[]; changed: boolean }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const vehicle = await db.vehicle.findUnique({
      where: { id: vehicleId },
      select: { photos: true, publicPhotoPaths: true, webPublished: true },
    });
    if (!vehicle) throw new PhotoMutationError(404, 'Vehicle not found');
    const current = vehicle.photos;
    const approved = vehicle.publicPhotoPaths;
    let next: string[];
    switch (mutation.type) {
      case 'append':
        if (current.includes(mutation.path)) return { photos: current, changed: false };
        if (current.length >= MAX_PHOTOS)
          throw new PhotoMutationError(400, `Máximo de ${MAX_PHOTOS} fotos por viatura.`);
        next = [...current, mutation.path];
        break;
      case 'remove':
        if (!current.includes(mutation.path)) throw new PhotoMutationError(404, 'Photo not found');
        next = current.filter((path) => path !== mutation.path);
        break;
      case 'reorder': {
        const requested = new Set(mutation.photos);
        if (requested.size !== mutation.photos.length)
          throw new PhotoMutationError(400, 'Duplicate photos');
        if (
          current.length !== mutation.photos.length ||
          current.some((path) => !requested.has(path))
        )
          throw conflict();
        next = mutation.photos;
        break;
      }
    }
    if (vehicle.webPublished && next.length && !approved.includes(next[0]!))
      throw new PhotoMutationError(
        409,
        'A foto principal não está selecionada para o site. Use o editor para escolher outra principal autorizada ou incluir explicitamente esta fotografia.',
      );
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.vehicle.updateMany({
        where: {
          id: vehicleId,
          photos: { equals: current },
          publicPhotoPaths: { equals: approved },
        },
        data: {
          photos: { set: next },
          // A shared cover/order never grants permission to publish a private photo.
          publicPhotoPaths: {
            set:
              mutation.type === 'reorder'
                ? next.filter((path) => approved.includes(path))
                : approved.filter((path) => next.includes(path)),
          },
        },
      });
      return updated;
    });
    if (result.count === 1) {
      cache.clearPrefix('dashboard:');
      return { photos: next, changed: true };
    }
    if (mutation.type === 'reorder') throw conflict();
  }
  throw conflict();
}
