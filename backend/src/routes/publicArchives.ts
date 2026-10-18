import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUser, type AuthedRequest } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { publicVehicleWhere } from '../lib/data/publicVehicle.js';
import { emitActivity } from '../lib/data/activity.js';
import { prepareArchivePhoto, syncPublishedArchive } from '../lib/server/publicArchive.js';

const router = Router();
router.use(requireUser);
router.use((req: AuthedRequest, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});
const slugSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const actionSchema = z
  .object({ action: z.enum(['withdraw', 'withdraw-photo', 'authorize-current']) })
  .strict();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = z
      .object({ q: z.string().trim().max(200).optional() })
      .strict()
      .safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'Pesquisa inválida.' });
      return;
    }
    const q = query.data.q;
    const rows = await prisma.publicVehicleArchive.findMany({
      where: q
        ? {
            OR: ['slug', 'brand', 'model'].map((key) => ({
              [key]: { contains: q, mode: 'insensitive' },
            })),
          }
        : {},
      orderBy: [{ updatedAt: 'desc' }, { slug: 'asc' }],
      take: 201,
      select: {
        slug: true,
        brand: true,
        model: true,
        year: true,
        identificationAllowed: true,
        photoAllowed: true,
        photoSourcePath: true,
        vehicle: {
          select: {
            id: true,
            webPublished: true,
            status: true,
            soldDate: true,
            sale: { select: { id: true } },
          },
        },
      },
    });
    res.json({
      items: rows
        .slice(0, 200)
        .map(({ vehicle, photoSourcePath, ...row }) => ({
          ...row,
          hasPhoto: row.photoAllowed && !!photoSourcePath,
          canAuthorize:
            !!vehicle?.webPublished &&
            ['AVAILABLE', 'RESERVED'].includes(vehicle.status) &&
            !vehicle.soldDate &&
            !vehicle.sale,
        })),
      truncated: rows.length > 200,
    });
  }),
);

router.patch(
  '/:slug',
  asyncHandler(async (req: AuthedRequest, res) => {
    const slug = slugSchema.safeParse(req.params.slug),
      input = actionSchema.safeParse(req.body);
    if (!slug.success || !input.success) {
      res.status(400).json({ error: 'Pedido inválido.' });
      return;
    }
    const existing = await prisma.publicVehicleArchive.findUnique({
      where: { slug: slug.data },
      select: { vehicleId: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Arquivo não encontrado.' });
      return;
    }
    const action = input.data.action;
    if (action === 'authorize-current') {
      // Cleared historical pixels cannot be recovered. Only a currently public source can be authorized again.
      const current = existing.vehicleId
        ? await prisma.vehicle.findFirst({
            where: { ...publicVehicleWhere(), id: existing.vehicleId },
            select: {
              id: true,
              brand: true,
              model: true,
              year: true,
              publicSlug: true,
              photos: true,
              publicPhotoPaths: true,
            },
          })
        : null;
      if (!current || current.publicSlug !== slug.data) {
        res
          .status(409)
          .json({
            error: 'Só pode autorizar novamente a partir de uma ficha atualmente publicada.',
          });
        return;
      }
      const photo = await prepareArchivePhoto(current.id, current.photos, current.publicPhotoPaths);
      const saved = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${current.id} FOR UPDATE`;
        const fresh = await tx.vehicle.findFirst({
          where: { ...publicVehicleWhere(), id: current.id, publicSlug: slug.data },
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
            photos: true,
            publicPhotoPaths: true,
          },
        });
        if (!fresh) return false;
        await syncPublishedArchive(
          tx,
          { ...fresh, slug: slug.data, approved: fresh.publicPhotoPaths },
          photo,
          true,
        );
        await emitActivity(tx, {
          actorId: req.user!.id,
          type: 'VEHICLE_UPDATED',
          entityType: 'vehicle',
          entityId: current.id,
          message: 'Autorizado o arquivo público mínimo',
          metadata: { slug: slug.data, action },
        });
        return true;
      });
      if (!saved) {
        res.status(409).json({ error: 'A publicação mudou entretanto. Atualize a página.' });
        return;
      }
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.publicVehicleArchive.update({
          where: { slug: slug.data },
          data: {
            ...(action === 'withdraw' ? { identificationAllowed: false } : {}),
            photoAllowed: false,
            photoSourcePath: null,
            photoBytes: null,
          },
        });
        await emitActivity(tx, {
          actorId: req.user!.id,
          type: 'VEHICLE_UPDATED',
          entityType: 'vehicle',
          entityId: existing.vehicleId ?? slug.data,
          message:
            action === 'withdraw'
              ? 'Retirado o arquivo público mínimo'
              : 'Retirada a fotografia do arquivo público',
          metadata: { slug: slug.data, action },
        });
      });
    }
    res.json({ saved: true });
  }),
);
export default router;
