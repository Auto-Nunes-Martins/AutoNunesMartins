import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';

function errorStatus(error: unknown): number {
  if (typeof error !== 'object' || error === null) return 500;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const candidate = status ?? statusCode;
  return typeof candidate === 'number' &&
    Number.isInteger(candidate) &&
    candidate >= 400 &&
    candidate <= 599
    ? candidate
    : 500;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = errorStatus(error);
  if (status >= 500) logger.error({ err: error }, 'Unhandled error');
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : 'Invalid request' });
};

/** Contact errors can carry private payloads: consume them before any logger. */
export const contactErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    // Delegating to Express's default handler could log the private error.
    res.destroy();
    return;
  }
  const status = errorStatus(error);
  res
    .set('Cache-Control', 'no-store')
    .status(status)
    .json({
      error:
        status >= 500
          ? 'Não foi possível processar o pedido.'
          : 'Pedido inválido ou demasiado longo.',
    });
};
