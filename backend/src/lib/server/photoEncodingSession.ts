import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PhotoUploadError, MAX_OUTPUT_BYTES, MAX_UPLOAD_BYTES } from './photoOptimization.js';
import { validManifest } from './photoVariantEncoding.js';
import type { EncodedVariants } from './photoVariantEncoding.js';
import type { optimizePhoto } from './photoOptimization.js';
import type { UploadTrace, DiagnosticPhase } from '../../../../shared/runtimeDiagnostics.mjs';
import { createCgroupReader } from '../../../../shared/containerMemory.mjs';
import { registerDiagnosticProvider } from '../../../../shared/nativeDiagnostics.mjs';
const activity = { created: 0, closed: 0, active: 0, peakWorkerRss: 0 };
registerDiagnosticProvider('codec', () => ({
  ...activity,
  isolatedProduction:
    process.env.NODE_ENV === 'production' && process.env.PHOTO_PROCESSING_MODE !== 'inline',
}));
type Photo = Awaited<ReturnType<typeof optimizePhoto>>;
type Pending = {
  id: number;
  kind: 'optimize' | 'variants';
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};
const workerKeys = new Set([
  'workerPid',
  'workerRss',
  'workerPeakRss',
  'workerHeapUsed',
  'workerExternal',
  'workerArrayBuffers',
  'workerCpuUserUs',
  'workerCpuSystemUs',
  'workerProcessing',
  'workerQueue',
  'workerOomPriorityAdjusted',
  'workerNoCredentials',
  'workerNodeMajor',
]);
export class PhotoEncodingSession {
  private child: ChildProcess;
  private pending?: Pending;
  private nextId = 0;
  private closing = false;
  private exited = false;
  private closed: Promise<void>;
  private closePromise?: Promise<void>;
  private started = performance.now();
  private metrics: Record<string, number> = { workerIsolated: 1 };
  private guard?: NodeJS.Timeout;
  private lifetime?: NodeJS.Timeout;
  constructor(private trace: UploadTrace) {
    let entry = fileURLToPath(new URL('./photoEncodingWorker.js', import.meta.url));
    if (!existsSync(entry)) entry = entry.replace(/\.js$/, '.ts');
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    for (const key of [
      'PATH',
      'Path',
      'SystemRoot',
      'WINDIR',
      'TEMP',
      'TMP',
      'MALLOC_ARENA_MAX',
      'LD_PRELOAD',
      'UV_THREADPOOL_SIZE',
    ])
      if (process.env[key]) env[key] = process.env[key];
    this.child = spawn(
      process.execPath,
      [
        ...(entry.endsWith('.ts') ? ['--import', 'tsx'] : ['--conditions=anm-runtime']),
        '--max-old-space-size=96',
        entry,
      ],
      {
        env,
        serialization: 'advanced',
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
        windowsHide: true,
      },
    );
    activity.created++;
    activity.active++;
    this.closed = new Promise((resolve) =>
      this.child.once('close', (code, signal) => {
        this.exited = true;
        activity.active--;
        activity.closed++;
        clearInterval(this.guard);
        clearTimeout(this.lifetime);
        this.metrics.workerExited = 1;
        this.metrics.workerRssAtExit = this.metrics.workerRss ?? 0;
        this.metrics.workerRss = 0;
        if (code !== null && code >= 0) this.metrics.workerExitCode = code;
        this.metrics.workerExitSignal =
          signal === 'SIGKILL' ? 9 : signal === 'SIGTERM' ? 15 : signal === 'SIGABRT' ? 6 : 0;
        this.metrics.workerLifetimeMs = Math.max(0, performance.now() - this.started);
        this.trace.fields(this.metrics);
        this.fail();
        resolve();
      }),
    );
    this.child.on('error', () => this.fail());
    this.child.on('message', (message) => this.message(message));
    const cgroup = createCgroupReader();
    const checkBudget = () => {
      if (this.closing || this.exited) return;
      let memory;
      try {
        memory = cgroup.read();
      } catch {
        return;
      }
      const headroom = memory.effectiveHeadroomBytes ?? memory.headroomBytes;
      if (memory.available && typeof headroom === 'number' && headroom < 16 * 1024 * 1024) {
        this.metrics.workerMemoryGuard = 1;
        this.trace.fields(this.metrics);
        this.fail(503);
        this.child.kill('SIGKILL');
        void this.close();
      }
    };
    this.guard = setInterval(checkBudget, 100);
    queueMicrotask(checkBudget);
    this.guard.unref();
    this.lifetime = setTimeout(() => {
      this.metrics.workerTimeout = 1;
      this.fail(504);
      void this.close();
    }, 180000);
    this.lifetime.unref();
  }
  private fail(status = 502) {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(
        new PhotoUploadError(
          status,
          status === 504
            ? 'O processamento da fotografia excedeu o tempo limite.'
            : status === 503
              ? 'Sem memória disponível para processar esta fotografia agora. Tente novamente.'
              : status === 415
                ? 'Apenas JPEG, PNG e WebP estáticos são aceites.'
                : status === 422
                  ? 'Fotografia inválida ou acima dos limites de processamento.'
                  : 'Não foi possível processar a fotografia. Tente novamente.',
        ),
      );
    }
  }
  private message(message: unknown) {
    if (!message || typeof message !== 'object') return;
    const value = message as {
      type?: string;
      id?: number;
      name?: string;
      metrics?: Record<string, number>;
      result?: unknown;
      status?: number;
    };
    if (value.type === 'sample' && value.metrics) {
      for (const [key, n] of Object.entries(value.metrics))
        if (workerKeys.has(key) && Number.isFinite(n) && n >= 0)
          this.metrics[key] = key === 'workerPeakRss' ? Math.max(this.metrics[key] ?? 0, n) : n;
      activity.peakWorkerRss = Math.max(activity.peakWorkerRss, this.metrics.workerPeakRss ?? 0);
      this.trace.fields(this.metrics);
      return;
    }
    if (this.closing) return;
    if (
      value.type === 'phase' &&
      ['metadata', 'optimize', 'sanitize', 'variant_encode'].includes(value.name ?? '')
    ) {
      this.trace.phase(value.name as DiagnosticPhase, value.metrics);
      return;
    }
    if (value.type === 'fields' && value.metrics) {
      this.trace.fields(value.metrics);
      return;
    }
    const pending = this.pending;
    if (!pending || pending.id !== value.id) return;
    if (value.type === 'failure') {
      this.fail([413, 415, 422].includes(value.status ?? 0) ? value.status : 502);
      return;
    }
    if (value.type === 'result') {
      clearTimeout(pending.timer);
      this.pending = undefined;
      pending.resolve(value.result);
    }
  }
  private request(kind: 'optimize' | 'variants', input: Buffer) {
    if (
      this.pending ||
      this.closing ||
      this.exited ||
      !input.length ||
      input.length > MAX_UPLOAD_BYTES
    )
      return Promise.reject(new PhotoUploadError(422, 'Fotografia inválida para processamento.'));
    return new Promise<unknown>((resolve, reject) => {
      const id = ++this.nextId;
      const timer = setTimeout(
        () => {
          this.fail(504);
          void this.close();
        },
        kind === 'optimize' ? 55000 : 125000,
      );
      this.pending = { id, kind, resolve, reject, timer };
      try {
        this.child.send({ type: 'job', id, kind, input }, (error) => {
          if (error) {
            this.fail();
            void this.close();
          }
        });
      } catch {
        this.fail();
        void this.close();
      }
    });
  }
  async optimize(input: Buffer): Promise<Photo> {
    const result = (await this.request('optimize', input)) as Photo;
    if (
      !result ||
      !Buffer.isBuffer(result.buffer) ||
      !result.buffer.length ||
      result.buffer.length > MAX_OUTPUT_BYTES ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(result.contentType) ||
      !['jpg', 'png', 'webp'].includes(result.extension) ||
      typeof result.optimized !== 'boolean'
    )
      throw new PhotoUploadError(502, 'Resposta de processamento inválida.');
    return result;
  }
  async variants(input: Buffer): Promise<EncodedVariants> {
    const result = (await this.request('variants', input)) as EncodedVariants;
    if (
      !result ||
      !validManifest(result.manifest) ||
      !Array.isArray(result.files) ||
      result.files.length !== result.manifest.variants.length ||
      !Buffer.isBuffer(result.sidecar) ||
      result.sidecar.length > 8192 ||
      result.files.some(
        (f, i) =>
          !Buffer.isBuffer(f.buffer) ||
          f.width !== result.manifest.variants[i]?.width ||
          f.buffer.length !== result.manifest.variants[i]?.bytes,
      ) ||
      result.files.reduce((n, f) => n + f.buffer.length, result.sidecar.length) > 16 * 1024 * 1024
    )
      throw new PhotoUploadError(502, 'Resposta de tamanhos inválida.');
    return result;
  }
  abort() {
    void this.close();
  }
  close(): Promise<void> {
    return (this.closePromise ??= this.stop());
  }
  private async stop() {
    this.closing = true;
    this.fail();
    if (this.exited) return;
    const start = performance.now();
    this.trace.phase('worker_exit');
    const force = setTimeout(() => {
      if (!this.exited) this.child.kill('SIGKILL');
    }, 1000);
    try {
      try {
        if (this.child.connected)
          this.child.send({ type: 'shutdown' }, (error) => {
            if (error && !this.exited) this.child.kill('SIGKILL');
          });
        else this.child.kill('SIGKILL');
      } catch {
        if (!this.exited) this.child.kill('SIGKILL');
      }
      await this.closed;
    } finally {
      clearTimeout(force);
      this.metrics.workerExitWaitMs = Math.max(0, performance.now() - start);
      this.trace.fields(this.metrics);
    }
  }
}
