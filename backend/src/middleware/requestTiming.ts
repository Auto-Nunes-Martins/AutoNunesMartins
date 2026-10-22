import type { RequestHandler, Response } from 'express';
import { AsyncLocalStorage } from 'node:async_hooks';
const database = new AsyncLocalStorage<{ count: number; ms: number }>();

export function recordDatabaseTiming(ms: number) {
  const timing = database.getStore();
  if (timing) { timing.count++; timing.ms += ms; }
}

export function recordRequestTiming(res: Response, stage: string, ms: number) {
  const calls = res.locals.anmTiming as { stage: string; ms: number }[] | undefined;
  calls?.push({ stage, ms });
}

export function timedMiddleware(stage: string, handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const start = performance.now();
    handler(req, res, (error) => { recordRequestTiming(res, stage, performance.now() - start); next(error); });
  };
}

export function requestTiming(enabled: boolean): RequestHandler {
  return (_req, res, next) => {
    if (!enabled) { next(); return; }
    const start = performance.now();
    const queries = { count: 0, ms: 0 };
    res.locals.anmTiming = [];
    const json = res.json;
    res.json = function (body) {
      const calls = [...res.locals.anmTiming, { stage: 'backend-db', ms: queries.ms }, { stage: 'backend-total', ms: performance.now() - start }];
      res.append('Server-Timing', calls.map(call => `${call.stage};dur=${call.ms.toFixed(1)}`).join(', '));
      return json.call(this, body);
    };
    database.run(queries, next);
  };
}
