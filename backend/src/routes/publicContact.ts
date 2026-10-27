import { cache } from '../lib/data/cache.js';
import type { ContactBudgetStore } from '../lib/server/contactBudget.js';
import { contactEmailHtml } from '../lib/server/contactEmail.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((v) => !/[\r\n]/.test(v)),
    email: z.string().trim().email().max(254),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((v) => !/[\r\n]/.test(v)),
    message: z.string().trim().min(1).max(5000),
    page: z
      .string()
      .max(300)
      .regex(/^\/[a-zA-Z0-9/_-]*$/),
    website: z.string().max(200).default(''),
    requestId: z.string().uuid(),
  })
  .strict();

export interface ContactConfig {
  enabled: boolean;
  apiKey?: string;
  from?: string;
  to?: string;
  relaySecret?: string;
}

// Persist only keyed hashes, counters and send status; no contact records or message bodies.
export function createPublicContactRouter(
  config: ContactConfig,
  send: typeof fetch = fetch,
  budget?: ContactBudgetStore,
) {
  const router = Router();
  const ready = () =>
    config.enabled && config.apiKey && config.from && config.to && config.relaySecret && budget;
  const authorised = (token: string | undefined) => {
    const expected = Buffer.from(config.relaySecret ?? '');
    const actual = Buffer.from(token ?? '');
    return (
      expected.length > 0 && actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  };
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      if (!ready()) {
        res.status(503).json({ error: 'O envio de pedidos ainda não está disponível.' });
        return;
      }
      if (!authorised(req.header('x-contact-relay'))) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (!req.is('application/json')) {
        res.status(415).json({ error: 'Formato inválido.' });
        return;
      }
      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Verifique os campos do formulário.' });
        return;
      }
      const data = parsed.data;
      if (data.website) {
        res.status(400).json({ error: 'Não foi possível enviar o pedido.' });
        return;
      }
      const text = `Pedido de contacto — Auto Nunes Martins\n\nNome: ${data.name}\nEmail: ${data.email}\nAssunto: ${data.subject}\nPágina: ${data.page}\n\n${data.message}\n\nUm pedido de visita não constitui um agendamento confirmado. Responda ao cliente para combinar o horário.`;
      const emailBody = JSON.stringify({
        from: config.from,
        to: [config.to],
        reply_to: data.email,
        subject: `Pedido do site: ${data.subject}`,
        text,
        html: contactEmailHtml(data),
      });
      let reservation;
      try {
        reservation = await budget!.reserve(
          req.header('x-contact-client') ?? req.ip ?? 'unknown',
          data.requestId,
          emailBody,
        );
      } catch {
        res.status(503).json({ error: 'O envio de pedidos est� temporariamente indispon�vel.' });
        return;
      }
      if (reservation.kind === 'sent') {
        res.status(202).json({ ok: true });
        return;
      }
      if (reservation.kind === 'limited') {
        res
          .set('Retry-After', String(reservation.retryAfter))
          .status(429)
          .json({ error: 'Limite de envios atingido. Tente mais tarde.' });
        return;
      }
      if (reservation.kind === 'conflict') {
        res
          .status(409)
          .json({ error: 'Este pedido j� n�o pode ser repetido. Abra um novo formul�rio.' });
        return;
      }
      try {
        const response = await send('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `contact/${data.requestId}/${createHash('sha256').update(text).digest('hex')}`,
          },
          body: emailBody,
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) throw new Error('Provider rejected send');
        const result = (await response.json()) as { id?: string };
        if (!result.id) throw new Error('Missing provider acknowledgement');
        await budget!.finish(reservation.key, reservation.token, true, {
          name: data.name,
          subject: data.subject,
        });
        cache.clearPrefix('notifications:');
        cache.clearPrefix('dashboard:');
        res.status(202).json({ ok: true });
      } catch {
        try {
          await budget!.finish(reservation.key, reservation.token, false);
        } catch {
          /* Fail closed on the next reservation. */
        }
        // Never log provider errors, request bodies, customer addresses or credentials.
        res.status(502).json({
          error: 'Não foi possível confirmar o envio. Tente novamente dentro de alguns instantes.',
        });
      }
    }),
  );
  return router;
}
