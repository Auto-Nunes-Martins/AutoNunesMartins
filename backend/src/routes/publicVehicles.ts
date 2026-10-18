import { asyncHandler } from '../middleware/asyncHandler.js';
import { isPhotoWidth, readPhotoBytes } from '../lib/server/photoVariants.js';
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
import { readPublicArchive, readPublicArchivePhoto } from '../lib/server/publicArchive.js';

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
      res.json(await listPublicVehicles(prisma, query.data));
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

router.get('/selection', asyncHandler(async (req, res) => {
  const raw = req.query.id === undefined ? [] : Array.isArray(req.query.id) ? req.query.id : [req.query.id];
  const parsed = z.array(publicSlugSchema).max(3).refine(ids => new Set(ids).size === ids.length).safeParse(raw);
  if (!parsed.success || Object.keys(req.query).some(key => key !== 'id')) { res.status(400).json({ error: 'Invalid selection' }); return; }
  try { res.json({ items: await getPublicSelection(prisma, parsed.data) }); }
  catch { logger.error('Public selection unavailable'); res.status(503).json({ error: 'Selection unavailable' }); }
}));

router.get('/homepage-highlights', asyncHandler(async (_req, res) => {
  try { res.json(await readPublicHighlights(prisma)); }
  catch { logger.error('Public homepage highlights unavailable'); res.status(503).json({ error: 'Destaques temporariamente indisponíveis' }); }
}));

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
      res.json(items);
    } catch {
      logger.error('Related public vehicles unavailable');
      res.status(503).json({ error: 'Related vehicles temporarily unavailable' });
    }
  }),
);

router.get('/archive/:slug/photo', asyncHandler(async (req, res) => {
  const slug = publicSlugSchema.safeParse(req.params.slug);
  if (!slug.success) { res.status(404).end(); return; }
  try {
    const bytes = await readPublicArchivePhoto(prisma, slug.data);
    if (!bytes) { res.status(404).end(); return; }
    res.set({ 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' });
    res.send(bytes);
  } catch { res.status(503).end(); }
}));

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = publicSlugSchema.safeParse(req.params.slug);
    if (!slug.success) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    try {
      const vehicle = await getPublicVehicle(prisma, slug.data);
      if (!vehicle) {
        const archive = await readPublicArchive(prisma, slug.data);
        res.status(404).json({ error: 'Vehicle not found', ...(archive ? { archive } : {}) });
        return;
      }
      res.json(vehicle);
    } catch {
      logger.error('Public vehicle detail unavailable');
      res.status(503).json({ error: 'Public catalogue temporarily unavailable' });
    }
  }),
);

router.get('/:slug/photos/access',asyncHandler(async(req,res)=>{
  const slug=publicSlugSchema.safeParse(req.params.slug);
  if(!slug.success){res.status(404).json({error:'Photos unavailable'});return;}
  try{const versions=await getPublicPhotoVersions(prisma,slug.data);if(!versions){res.status(404).json({error:'Photos unavailable'});return;}res.json({versions});}
  catch{logger.error('Public photo authorization unavailable');res.status(503).json({error:'Photos temporarily unavailable'});}
}));
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
      const width=req.query.w===undefined?undefined:Number(req.query.w);
      if(width!==undefined&&(!isPhotoWidth(width)||String(width)!==req.query.w)){res.status(400).json({error:'Invalid photo size'});return;}
      const path = await getPublicPhotoPath(prisma, slug.data, index.data);
      if (!path) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }
      const photo=await readPhotoBytes(path,width as import('../lib/server/photoVariants.js').PhotoWidth|undefined);
      if (!photo) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }
      res.set({
        'Content-Type': photo.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Photo-Version': publicPhotoVersion(path),
      });
      if(width){res.set({'Cache-Control':'private, no-cache, max-age=0, must-revalidate','ETag':photo.etag});if(req.get('if-none-match')===photo.etag){res.status(304).end();return;}}
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
