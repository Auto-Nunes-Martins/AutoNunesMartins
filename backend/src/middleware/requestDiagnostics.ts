import type { Request, Response, NextFunction } from 'express';
import { registerDiagnosticProvider } from '../../../shared/nativeDiagnostics.mjs';
const counters = {
  active: 0,
  started: 0,
  completed: 0,
  aborted: 0,
  serverErrors: 0,
  clientErrors: 0,
  maxDurationMs: 0,
  totalDurationMs: 0,
  photos: 0,
  publicPhotos: 0,
  other: 0,
};
registerDiagnosticProvider('http', () => ({ ...counters }));
export function requestDiagnostics(req: Request, res: Response, next: NextFunction) {
  if (process.env.RUNTIME_DIAGNOSTICS !== 'true') {
    next();
    return;
  }
  const started = performance.now();
  counters.active++;
  counters.started++;
  const group =
    req.path.startsWith('/api/public/vehicles') && req.path.includes('/photos/')
      ? 'publicPhotos'
      : req.path.startsWith('/api/vehicles/') && req.path.includes('/photos')
        ? 'photos'
        : 'other';
  counters[group]++;
  let done = false;
  function finish() {
    if (done) return;
    done = true;
    res.off('finish', finish);
    res.off('close', finish);
    counters.active--;
    counters.completed++;
    if (!res.writableFinished) counters.aborted++;
    if (res.statusCode >= 500) counters.serverErrors++;
    else if (res.statusCode >= 400) counters.clientErrors++;
    const elapsed = Math.max(0, performance.now() - started);
    counters.totalDurationMs += elapsed;
    counters.maxDurationMs = Math.max(counters.maxDurationMs, elapsed);
  }
  res.once('finish', finish);
  res.once('close', finish);
  next();
}
