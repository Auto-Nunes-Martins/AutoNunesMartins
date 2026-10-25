import { asyncHandler } from '../middleware/asyncHandler.js';
import { withCoverPhotoDimensions } from '../lib/data/photoDimensions.js';
import {
  isPhotoWidth,
  readPhotoBytes,
  preparePublicThumbnails,
} from '../lib/server/photoVariants.js';
import { readPublicHighlights } from '../lib/server/homepageHighlights.js';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import {
  getPublicPhotoPath,
  getPublicPhotoVersions,
  getPublicSelection,
  publicPhotoVersion,
  getPublicVehicle,
  listPublicVehicles,
  listAvailablePublicBrands,
  relatedPublicVehicles,
} from '../lib/data/publicVehicle.js';
import { publicSlugSchema, publicVehicleQuerySchema } from '../lib/domain/publicVehicle.js';
import { isPublicPhotoVersion, REVALIDATE_PUBLIC_PHOTO } from '../../../shared/publicPhotoCache.mjs';
import {
  readUnavailableVehicle,
  unavailableVehiclePhotoPath,
} from '../lib/data/unavailableVehicle.js';

const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = publicVehicleQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'Invalid public filters' });
      return;
    }
    try {
      const result = await listPublicVehicles(prisma, query.data);
      result.items = await withCoverPhotoDimensions(prisma, result.items);
      res.json(result);
    } catch {
      logger.error('Public vehicle listing unavailable');
      res.status(503).json({ error: 'Public catalogue temporarily unavailable' });
    }
  }),
);

router.get(
  '/brands',
  asyncHandler(async (req, res) => {
    if (Object.keys(req.query).length) {
      res.status(400).json({ error: 'Brand directory does not accept filters' });
      return;
    }
    try {
      res.json(await listAvailablePublicBrands(prisma));
    } catch {
      logger.error('Public brand directory unavailable');
      res.status(503).json({ error: 'Public brand directory temporarily unavailable' });
    }
  }),
);

router.get(
  '/selection',
  asyncHandler(async (req, res) => {
    const raw =
      req.query.id === undefined ? [] : Array.isArray(req.query.id) ? req.query.id : [req.query.id];
    const parsed = z
      .array(publicSlugSchema)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length)
      .safeParse(raw);
    if (!parsed.success || Object.keys(req.query).some((key) => key !== 'id')) {
      res.status(400).json({ error: 'Invalid selection' });
      return;
    }
    try {
      const items = await getPublicSelection(prisma, parsed.data);
      const vehicles = await withCoverPhotoDimensions(prisma, items.flatMap(item => item.vehicle ? [item.vehicle] : []));
      const bySlug = new Map(vehicles.map(vehicle => [vehicle.slug, vehicle]));
      res.json({ items: items.map(item => ({ ...item, vehicle: item.vehicle ? bySlug.get(item.vehicle.slug) : null })) });
    } catch {
      logger.error('Public selection unavailable');
      res.status(503).json({ error: 'Selection unavailable' });
    }
  }),
);

router.get(
  '/homepage-highlights',
  asyncHandler(async (_req, res) => {
    try {
      res.json(await readPublicHighlights(prisma));
    } catch {
      logger.error('Public homepage highlights unavailable');
      res.status(503).json({ error: 'Destaques temporariamente indisponíveis' });
    }
  }),
);

router.get(
  '/:slug/related',
  asyncHandler(async (req, res) => {
    const slug = publicSlugSchema.safeParse(req.params.slug);
    if (!slug.success) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    try {
      const items = await relatedPublicVehicles(prisma, slug.data);
      if (items === null) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json(await withCoverPhotoDimensions(prisma, items));
    } catch {
      logger.error('Related public vehicles unavailable');
      res.status(503).json({ error: 'Related vehicles temporarily unavailable' });
    }
  }),
);

router.get(
  '/unavailable/:slug/photo',
  asyncHandler(async (req, res) => {
    const slug = publicSlugSchema.safeParse(req.params.slug);
    if (!slug.success) {
      res.status(404).end();
      return;
    }
    try {
      const path = await unavailableVehiclePhotoPath(prisma, slug.data);
      const photo = path ? await readPhotoBytes(path, 800) : null;
      if (!photo) {
        res.status(404).end();
        return;
      }
      res.set({
        'Content-Type': photo.contentType,
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      });
      res.send(photo.buffer);
    } catch {
      res.status(503).end();
    }
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = publicSlugSchema.safeParse(req.params.slug);
    if (!slug.success) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    try {
      const vehicle = await getPublicVehicle(prisma, slug.data, preparePublicThumbnails);
      if (!vehicle) {
        const unavailableVehicle = await readUnavailableVehicle(prisma, slug.data);
        res.status(404).json({
          error: 'Vehicle not found',
          ...(unavailableVehicle ? { unavailableVehicle } : {}),
        });
        return;
      }
      res.json(vehicle);
    } catch {
      logger.error('Public vehicle detail unavailable');
      res.status(503).json({ error: 'Public catalogue temporarily unavailable' });
    }
  }),
);

router.get(
  '/:slug/photos/access',
  asyncHandler(async (req, res) => {
    const slug = publicSlugSchema.safeParse(req.params.slug);
    if (!slug.success) {
      res.status(404).json({ error: 'Photos unavailable' });
      return;
    }
    try {
      const versions = await getPublicPhotoVersions(prisma, slug.data);
      if (!versions) {
        res.status(404).json({ error: 'Photos unavailable' });
        return;
      }
      res.json({ versions });
    } catch {
      logger.error('Public photo authorization unavailable');
      res.status(503).json({ error: 'Photos temporarily unavailable' });
    }
  }),
);
router.get(
  '/:slug/photos/:index',
  asyncHandler(async (req, res) => {
    const slug = publicSlugSchema.safeParse(req.params.slug);
    const index = z
      .string()
      .regex(/^(?:[0-9]|1[0-9])$/)
      .transform(Number)
      .safeParse(req.params.index);
    if (!slug.success || !index.success) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }
    try {
      const width = req.query.w === undefined ? undefined : Number(req.query.w);
      const version = req.query.v;
      if (version !== undefined && !isPublicPhotoVersion(version)) {
        res.status(400).json({ error: 'Invalid photo version' });
        return;
      }
      if (width !== undefined && (!isPhotoWidth(width) || String(width) !== req.query.w)) {
        res.status(400).json({ error: 'Invalid photo size' });
        return;
      }
      const timingStart = performance.now();
      const timings: string[] = [];
      const record = (stage: string, ms: number) => {
        timings.push(`${stage};dur=${Math.max(0, ms).toFixed(1)}`);
      };
      const path = await getPublicPhotoPath(prisma, slug.data, index.data);
      record('photo-check', performance.now() - timingStart);
      if (!path) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }
      // Never serve the new occupant of an index under an old cache identity.
      const currentVersion = publicPhotoVersion(path);
      if (version !== undefined && version !== currentVersion) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }
      const photo = await readPhotoBytes(
        path,
        width as import('../lib/server/photoVariants.js').PhotoWidth | undefined,
        record,
      );
      if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }
      record('photo-total', performance.now() - timingStart);
      res.set({
        'Server-Timing': timings.join(', '),
        'Content-Type': photo.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Photo-Version': currentVersion,
        'X-Photo-Cache-Policy': 'shared-v1',
      });
      if (width || version) {
        res.set({
          'Cache-Control': REVALIDATE_PUBLIC_PHOTO,
          ETag: photo.etag,
        });
        if (req.get('if-none-match') === photo.etag) {
          res.status(304).end();
          return;
        }
      }
      res.send(photo.buffer);
    } catch {
      logger.error('Public vehicle photo unavailable');
      res.status(503).json({ error: 'Photo temporarily unavailable' });
    }
  }),
);

// No mutations and no fall-through into authenticated CRM routes.
router.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
export default router;
