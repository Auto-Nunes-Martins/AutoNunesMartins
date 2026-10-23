import { z } from 'zod';
import { descriptionText } from '@anm/types/richDescription';
import { publicSpecificationsSchema, vehicleUpdateSchema, licensePlatePtSchema } from '@anm/types';
import { lockVehicle, saleMutation } from './saleFinancials.js';
import {
  updateVehicleInTransaction,
  VehicleNotFound,
  VehicleStateConflict,
  type ActorContext,
} from './vehicleService.js';
import { applyWebPublication, WebPublicationError } from './webPublicationService.js';
import { isApprovedPhotoPath, SLUG_SUFFIX_LENGTHS } from '../domain/publicVehicle.js';
import { getBucketName, getSupabase } from '../data/storage.js';
import sharp from 'sharp';
import { MAX_OUTPUT_BYTES, MAX_UPLOAD_PIXELS } from './photoOptimization.js';
import { prisma } from '../../db.js';

export const vehicleEditSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime(),
    data: vehicleUpdateSchema
      .omit({ id: true })
      .extend({
        licensePlate: z.preprocess(
          (value) => (typeof value === 'string' && !value.trim() ? null : value),
          licensePlatePtSchema.optional(),
        ),
      })
      .strict(),
    photos: z
      .array(z.string().max(160))
      .max(20)
      .refine((paths) => new Set(paths).size === paths.length),
    uploadedPhotos: z
      .array(z.string().max(160))
      .max(20)
      .refine((paths) => new Set(paths).size === paths.length)
      .default([]),
    publication: z
      .object({
        published: z.boolean(),
        price: z
          .string()
          .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
          .refine((value) => Number(value) > 0)
          .nullable(),
        description: z.string().trim().max(6000),
        photoPaths: z
          .array(z.string().max(160))
          .max(20)
          .refine((paths) => new Set(paths).size === paths.length),
        transmission: z.enum(['MANUAL', 'AUTOMATIC']).nullable(),
        specifications: publicSpecificationsSchema,
      })
      .strict()
      .refine(
        (value) => !value.published || descriptionText(value.description).trim().length > 0,
        'Uma descrição pública é obrigatória.',
      )
      .optional(),
  })
  .strict();

/** Existing/new private uploads must already belong to this vehicle. No arbitrary path attachment. */
export async function saveVehicleEdit(
  id: string,
  input: z.infer<typeof vehicleEditSchema>,
  actor: ActorContext,
) {
  // Immutable staged objects have no vehicle/public association until the transaction commits.
  for (const path of input.uploadedPhotos) {
    if (!input.photos.includes(path) || !isApprovedPhotoPath(id, path))
      throw new VehicleStateConflict('Fotografia preparada inválida.', 409, 'photos');
    const { data, error } = await getSupabase().storage.from(getBucketName()).download(path);
    if (
      error ||
      !data ||
      data.size > MAX_OUTPUT_BYTES ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(data.type)
    )
      throw new VehicleStateConflict(
        'Uma fotografia preparada já não está disponível. Volte a selecionar o ficheiro.',
        409,
        'photos',
      );
    const meta = await sharp(Buffer.from(await data.arrayBuffer()), {
      limitInputPixels: MAX_UPLOAD_PIXELS,
      failOn: 'warning',
    }).metadata();
    if (
      !meta.width ||
      !meta.height ||
      (meta.pages ?? 1) !== 1 ||
      !['jpeg', 'png', 'webp'].includes(meta.format ?? '')
    )
      throw new VehicleStateConflict('Fotografia preparada inválida.', 409, 'photos');
  }
  for (const suffixLength of SLUG_SUFFIX_LENGTHS) {
    try {
      return await saleMutation(async (tx) => {
        await lockVehicle(tx, id);
        const current = await tx.vehicle.findUnique({
          where: { id },
          select: { updatedAt: true, photos: true, publicPhotoPaths: true, webPublished: true },
        });
        if (!current) throw new VehicleNotFound(id);
        if (current.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new VehicleStateConflict(
            'A viatura foi alterada entretanto. O rascunho foi mantido; atualize a ficha e reveja as alterações antes de guardar.',
          );
        if (
          input.photos.some(
            (path) => !current.photos.includes(path) && !input.uploadedPhotos.includes(path),
          )
        )
          throw new VehicleStateConflict(
            'Uma fotografia já não pertence a esta viatura. Reveja as fotografias.',
            409,
            'photos',
          );
        const approved = input.publication?.photoPaths;
        const nextApproval = approved ?? current.publicPhotoPaths;
        if (
          (input.publication || JSON.stringify(input.photos) !== JSON.stringify(current.photos)) &&
          (input.publication?.published ?? current.webPublished) &&
          input.photos.length &&
          !nextApproval.includes(input.photos[0]!)
        )
          throw new WebPublicationError(
            409,
            'A foto principal não está selecionada para o site. Escolha outra foto principal entre as selecionadas ou volte a incluir esta fotografia.',
            'publication.photoPaths',
          );
        if (
          approved?.some((path) => !input.photos.includes(path) || !isApprovedPhotoPath(id, path))
        )
          throw new VehicleStateConflict(
            'A seleção pública contém uma fotografia indisponível ou de outra viatura.',
            409,
            'photos',
          );
        await updateVehicleInTransaction(tx, id, input.data, actor);
        await tx.vehicle.update({
          where: { id },
          data: {
            photos: { set: input.photos },
            publicPhotoPaths: {
              set: input.photos.filter((path) => current.publicPhotoPaths.includes(path)),
            },
          },
        });
        if (input.publication) {
          const publication = input.publication;
          await applyWebPublication(
            tx,
            id,
            publication.published ? { ...publication, published: true } : { published: false },
            actor.actorId,
            suffixLength,
          );
          if (!publication.published)
            await tx.vehicle.update({
              where: { id },
              data: {
                publicPrice: publication.price,
                publicDescription: publication.description,
                publicPhotoPaths: publication.photoPaths,
                publicTransmission: publication.transmission,
                publicSpecifications: publication.specifications,
              },
            });
        }
        await tx.vehicle.update({
          where: { id },
          data: { updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
        });
        return { removedPhotos: current.photos.filter((path) => !input.photos.includes(path)) };
      });
    } catch (error) {
      const conflict = error as { code?: string; meta?: { target?: unknown } };
      if (conflict.code === 'P2002' && JSON.stringify(conflict.meta?.target).includes('publicSlug'))
        continue;
      throw error;
    }
  }
  throw new VehicleStateConflict('Conflito ao criar o endereço público. Tente novamente.');
}
