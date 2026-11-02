import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PhotoUploadError, MAX_OUTPUT_BYTES, MAX_UPLOAD_BYTES } from './photoOptimization.js';
import { validManifest } from './photoVariantEncoding.js';
import type { EncodedVariants } from './photoVariantEncoding.js';
import type { optimizePhoto } from './photoOptimization.js';
import {
  MAX_REVIEW_AVATAR_BYTES,
  MAX_REVIEW_AVATAR_OUTPUT_BYTES,
  type normalizeReviewAvatar,
} from './reviewAvatar.js';
import { createCgroupReader } from '../../../../shared/containerMemory.mjs';
type Photo = Awaited<ReturnType<typeof optimizePhoto>>;
type ReviewAvatar = Awaited<ReturnType<typeof normalizeReviewAvatar>>;
type EncodingJob = 'optimize' | 'variants' | 'avatar';
type Pending = {
  id: number;
  kind: EncodingJob;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};
export class PhotoEncodingSession {
  private child: ChildProcess;
  private pending?: Pending;
  private nextId = 0;
  private closing = false;
  private exited = false;
  private closed: Promise<void>;
  private closePromise?: Promise<void>;
  private guard?: NodeJS.Timeout;
  private lifetime?: NodeJS.Timeout;
  constructor() {
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

    this.closed = new Promise((resolve) =>
      this.child.once('close', () => {
        this.exited = true;

        clearInterval(this.guard);
        clearTimeout(this.lifetime);

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
        this.fail(503);
        this.child.kill('SIGKILL');
        void this.close();
      }
    };
    this.guard = setInterval(checkBudget, 100);
    queueMicrotask(checkBudget);
    this.guard.unref();
    this.lifetime = setTimeout(() => {
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
      result?: unknown;
      status?: number;
    };
    if (this.closing) return;
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
  private request(kind: EncodingJob, input: Buffer) {
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
        kind === 'variants' ? 125000 : 55000,
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
  async avatar(input: Buffer): Promise<ReviewAvatar> {
    if (input.length > MAX_REVIEW_AVATAR_BYTES)
      throw new PhotoUploadError(422, 'Fotografia inválida para processamento.');
    const result = (await this.request('avatar', input)) as ReviewAvatar;
    if (
      !result ||
      !Buffer.isBuffer(result.avatarData) ||
      result.avatarData.length < 12 ||
      result.avatarData.length > MAX_REVIEW_AVATAR_OUTPUT_BYTES ||
      result.avatarData.toString('ascii', 0, 4) !== 'RIFF' ||
      result.avatarData.toString('ascii', 8, 12) !== 'WEBP' ||
      typeof result.avatarVersion !== 'string' ||
      result.avatarVersion !== createHash('sha256').update(result.avatarData).digest('hex')
    )
      throw new PhotoUploadError(502, 'Resposta de avatar inválida.');
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
    }
  }
}
