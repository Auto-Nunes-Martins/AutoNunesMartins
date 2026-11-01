import express, { Router } from 'express';
import { z } from 'zod';
import { reviewInputSchema } from '@anm/types';
import { prisma } from '../db.js';
import { requireUser } from '../middleware/clerk.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { MAX_REVIEW_AVATAR_BYTES, normalizeReviewAvatar } from '../lib/server/reviewAvatar.js';
import { photoAdmission } from '../lib/server/photoOptimization.js';

const select = { id: true, authorName: true, rating: true, text: true, avatarVersion: true } as const;
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
function reviewId(req: express.Request) {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) throw Object.assign(new Error('Invalid review'), { status: 400 });
  return parsed.data;
}
async function list() {
  return { items: await prisma.webReview.findMany({ select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }) };
}
export const publicReviewsRouter = Router();
publicReviewsRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
publicReviewsRouter.get('/', asyncHandler(async (_req, res) => {
  try { res.json(await list()); }
  catch { res.status(503).json({ error: 'Reviews temporarily unavailable' }); }
}));
publicReviewsRouter.get('/:id/avatar/:version', asyncHandler(async (req, res) => {
  if (!/^[a-f0-9]{64}$/.test(String(req.params.version))) { res.status(404).end(); return; }
  const review = await prisma.webReview.findUnique({ where: { id: reviewId(req) }, select: { avatarData: true, avatarVersion: true } });
  if (!review?.avatarData || review.avatarVersion !== req.params.version) { res.status(404).end(); return; }
  res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(Buffer.from(review.avatarData));
}));

const router = Router();
router.use(requireUser);
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', asyncHandler(async (_req, res) => { res.json(await list()); }));
router.post('/', asyncHandler(async (req, res) => {
  const parsed = reviewInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Indique o nome, 0,5 a 5 estrelas e um texto até 5000 caracteres.' }); return; }
  res.status(201).json(await prisma.webReview.create({ data: parsed.data, select }));
}));
router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = reviewInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Review inválida. Verifique o nome, as estrelas e o texto.' }); return; }
  res.json(await prisma.webReview.update({ where: { id: reviewId(req) }, data: parsed.data, select }));
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.webReview.delete({ where: { id: reviewId(req) } });
  res.status(204).end();
}));
const readAvatar = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/gif', 'application/octet-stream'], limit: MAX_REVIEW_AVATAR_BYTES });
router.put('/:id/avatar', asyncHandler(async (req, res) => {
  const id = reviewId(req);
  const release = photoAdmission.acquire();
  if (!release) { res.set('Retry-After', '3').status(429).json({ error: 'Outra imagem está a ser processada. Tente novamente.' }); return; }
  try {
    // Match the existing photo pipeline: admission covers receiving, decoding and persistence.
    await new Promise<void>((resolve, reject) => readAvatar(req, res, (error) => error ? reject(error) : resolve()));
    if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'Escolha uma imagem JPEG, PNG, WebP, AVIF ou HEIC.' }); return; }
    let avatar;
    try { avatar = await normalizeReviewAvatar(req.body); }
    catch { res.status(400).json({ error: 'Imagem inválida. Use uma fotografia estática até 5 MB e 16 megapíxeis.' }); return; }
    res.json(await prisma.webReview.update({ where: { id }, data: avatar, select }));
  } finally { release(); }
}));
router.delete('/:id/avatar', asyncHandler(async (req, res) => {
  res.json(await prisma.webReview.update({ where: { id: reviewId(req) }, data: { avatarData: null, avatarVersion: null }, select }));
}));
router.use(((error, _req, res, next) => {
  if ((error as { code?: string })?.code === 'P2025') { res.status(404).json({ error: 'Review não encontrada.' }); return; }
  if ((error as { type?: string })?.type === 'entity.too.large') { res.status(413).json({ error: 'A fotografia não pode ultrapassar 5 MB.' }); return; }
  next(error);
}) as express.ErrorRequestHandler);
export default router;
