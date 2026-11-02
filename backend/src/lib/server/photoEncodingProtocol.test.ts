import type { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type Job = { type: string; id?: number; kind?: string; input?: Buffer };
type FakeChild = EventEmitter & {
  connected: boolean;
  jobs: Job[];
  send: (job: Job, callback?: (error: Error | null) => void) => void;
  kill: (signal: string) => void;
};
const fixture = vi.hoisted(() => ({ children: [] as FakeChild[] }));
vi.mock('node:child_process', async () => {
  const { EventEmitter } = await import('node:events');
  return {
    spawn: vi.fn(() => {
      const child = Object.assign(new EventEmitter(), {
        connected: true,
        jobs: [] as Job[],
        send(job: Job, callback?: (error: Error | null) => void) {
          this.jobs.push(job);
          callback?.(null);
          if (job.type === 'shutdown') child.emit('close', 0, null);
        },
        kill(signal: string) {
          child.emit('close', null, signal);
        },
      });
      fixture.children.push(child);
      return child;
    }),
  };
});
vi.mock('../../../../shared/containerMemory.mjs', () => ({
  createCgroupReader: () => ({ read: () => ({ available: false }) }),
}));
import { PhotoEncodingSession } from './photoEncodingSession';

function sessionFixture() {
  const session = new PhotoEncodingSession();
  return { session, child: fixture.children.at(-1)! };
}
beforeEach(() => {
  fixture.children.length = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it('enforces the avatar deadline and waits for shutdown without a parent fallback', async () => {
  const { session, child } = sessionFixture();
  const pending = session.avatar(Buffer.from('input'));
  const rejected = expect(pending).rejects.toMatchObject({ status: 504 });
  expect(child.jobs[0]).toMatchObject({ type: 'job', kind: 'avatar' });
  await vi.advanceTimersByTimeAsync(55000);
  await rejected;
  await session.close();
  expect(child.jobs.at(-1)?.type).toBe('shutdown');
});

it('rejects a crashed child and keeps close idempotent for avatars', async () => {
  const { session, child } = sessionFixture();
  const pending = session.avatar(Buffer.from('input'));
  const rejected = expect(pending).rejects.toMatchObject({ status: 502 });
  child.emit('close', 1, null);
  await rejected;
  await Promise.all([session.close(), session.close()]);

  expect(child.jobs).toHaveLength(1);
});

it.each(['oversized', 'wrong-format', 'wrong-hash', 'missing'] as const)(
  'rejects an invalid avatar result: %s',
  async (kind) => {
    const { session, child } = sessionFixture();
    const data = kind === 'oversized' ? Buffer.alloc(65537) : Buffer.from('RIFFxxxxWEBPfixture');
    if (kind === 'wrong-format') data.write('JPEG', 0, 'ascii');
    const result =
      kind === 'missing'
        ? null
        : {
            avatarData: data,
            avatarVersion:
              kind === 'wrong-hash'
                ? '0'.repeat(64)
                : createHash('sha256').update(data).digest('hex'),
          };
    const pending = session.avatar(Buffer.from('input'));
    const rejected = expect(pending).rejects.toMatchObject({ status: 502 });
    child.emit('message', { type: 'result', id: child.jobs[0].id, result });
    await rejected;
    await session.close();
  },
);
