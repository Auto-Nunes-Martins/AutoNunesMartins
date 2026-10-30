// Isolated experiment only. Never imported by an application service.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCgroupReader } from '../../shared/containerMemory.mjs';
import { appProcessTree } from '../../shared/applicationMemory.mjs';
const args = Object.fromEntries(
  process.argv.slice(2).map((v) => {
    const [key, ...value] = v.replace(/^--/, '').split('=');
    return [key, value.join('=') || 'true'];
  }),
);
const role = args.role ?? 'parent',
  count = Math.max(1, Math.min(11, Number(args.count) || 3)),
  idle = Math.max(100, Math.min(30000, Number(args.idle) || 1000));
const mb = (bytes) => Math.round(bytes / 10000) / 100;
const output = (value) => {
  if (!process.stdout.writableNeedDrain) process.stdout.write(JSON.stringify(value) + '\n');
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function ownSmaps() {
  if (process.platform !== 'linux') return null;
  try {
    const text = readFileSync('/proc/self/smaps_rollup', 'utf8'),
      result = {};
    for (const name of [
      'Rss',
      'Pss',
      'Private_Clean',
      'Private_Dirty',
      'Anonymous',
      'LazyFree',
      'Swap',
    ]) {
      const value = text.match(new RegExp('^' + name + ':\\s+(\\d+) kB$', 'm'));
      if (value) result[name + 'MB'] = mb(Number(value[1]) * 1024);
    }
    return result;
  } catch {
    return null;
  }
}
function send(value) {
  return new Promise((resolve) => {
    if (process.send && process.connected) process.send(value, () => resolve());
    else {
      output(value);
      resolve();
    }
  });
}
const dimensions = [
  [1976, 1476],
  [3505, 1948],
  [2788, 1830],
];
if (role === 'fixtures') {
  const sharp = (await import('sharp')).default;
  sharp.cache(false);
  sharp.concurrency(1);
  for (let index = 0; index < dimensions.length; index++) {
    const [width, height] = dimensions[index],
      raw = Buffer.alloc(width * height * 3);
    let state = 12345 + index;
    for (let i = 0; i < raw.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      raw[i] = state & 255;
    }
    await sharp(raw, { raw: { width, height, channels: 3 } })
      .jpeg({ quality: 90 })
      .toFile(path.join(args.directory, index + '.jpg'));
  }
  await send({
    event: 'native_probe',
    kind: 'synthetic_fixtures_ready',
    images: dimensions.length,
  });
} else if (role === 'worker') {
  globalThis.fetch = async () => {
    throw Error('Network forbidden in isolated probe');
  };
  const sharp = (await import('sharp')).default,
    { optimizePhoto } = await import('../src/lib/server/photoOptimization.ts'),
    { buildPhotoVariants } = await import('../src/lib/server/photoVariants.ts');
  let stage = 'idle',
    peaks = {};
  const sample = () => {
    const memory = process.memoryUsage();
    const peak = (peaks[stage] ??= { rss: 0, heapUsed: 0, external: 0, arrayBuffers: 0 });
    for (const key of Object.keys(peak)) peak[key] = Math.max(peak[key], memory[key]);
  };
  const timer = setInterval(sample, 100);
  timer.unref();
  const point = async (kind, extra = {}) => {
    sample();
    await send({
      event: 'native_probe',
      kind,
      pid: process.pid,
      time: new Date().toISOString(),
      memoryMB: Object.fromEntries(
        Object.entries(process.memoryUsage()).map(([key, value]) => [key, mb(value)]),
      ),
      smaps: ownSmaps(),
      vipsTrackedApproxMB: Object.fromEntries(
        Object.entries(sharp.cache().memory).map(([key, value]) => [key, mb(value * 1048576)]),
      ),
      sharpCounters: sharp.counters(),
      ...extra,
    });
  };
  await point('worker_baseline', {
    node: process.version,
    sharp: sharp.versions.sharp,
    vips: sharp.versions.vips,
    platform: process.platform,
  });
  async function round(index) {
    let input = await readFile(
      path.join(args.directory, ((index + Number(args.offset || 0)) % dimensions.length) + '.jpg'),
    );
    stage = 'optimize';
    const master = await optimizePhoto(input, {
      phase: (name) => {
        sample();
        stage = name;
      },
      fields() {},
      finish() {},
    });
    stage = 'variants';
    const built = await buildPhotoVariants(master.buffer);
    sample();
    const digest = createHash('sha256').update(master.buffer);
    for (const file of built.files) digest.update(file.buffer);
    return {
      fixture: (index + Number(args.offset || 0)) % dimensions.length,
      pipelineDigest: digest.digest('hex'),
      inputBytes: input.length,
      masterBytes: master.buffer.length,
      derivativeBytes: built.files.reduce((n, f) => n + f.buffer.length, 0),
      variants: built.files.length,
    };
  }
  try {
    for (let index = 0; index < count; index++) {
      peaks = {};
      const start = performance.now(),
        result = await round(index);
      stage = 'idle';
      await point('round_complete', {
        round: index + 1,
        durationMs: Math.round(performance.now() - start),
        ...result,
        phasePeaksMB: Object.fromEntries(
          Object.entries(peaks).map(([name, values]) => [
            name,
            Object.fromEntries(Object.entries(values).map(([key, value]) => [key, mb(value)])),
          ]),
        ),
      });
      global.gc?.();
      await point('after_test_gc', { round: index + 1 });
      await wait(idle);
      await point('idle', { round: index + 1 });
    }
  } finally {
    clearInterval(timer);
  }
} else {
  if (process.platform !== 'linux' && args['allow-windows-mechanism-test'] !== 'true') {
    output({
      event: 'native_probe',
      available: false,
      reason: 'Linux required for allocator/cgroup conclusions; no installation performed',
    });
    process.exit(0);
  }
  const root = fileURLToPath(new URL('../../', import.meta.url)),
    directoryRoot = path.join(root, 'apps/crm/.svelte-kit');
  await mkdir(directoryRoot, { recursive: true });
  const directory = await mkdtemp(path.join(directoryRoot, 'native-probe-'));
  const env = { NODE_ENV: 'test' };
  for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'])
    if (process.env[key]) env[key] = process.env[key];
  if (args.arenas) {
    if (process.platform !== 'linux' || !['2', '4'].includes(args.arenas))
      throw Error('Arena experiment requires Linux and 2 or 4');
    env.MALLOC_ARENA_MAX = args.arenas;
  }
  if (args.jemalloc) {
    if (args.arenas) throw Error('Choose one allocator experiment');
    if (
      process.platform !== 'linux' ||
      !path.isAbsolute(args.jemalloc) ||
      !/libjemalloc\.so(?:\.\d+)*$/.test(args.jemalloc)
    )
      throw Error('Explicit existing Linux jemalloc library required');
    await access(args.jemalloc);
    env.LD_PRELOAD = args.jemalloc;
  }
  const digests = new Map();
  let activeChild,
    aborted = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      aborted = true;
      activeChild?.kill('SIGTERM');
    });
  const cgroup = createCgroupReader();
  let peak = 0;
  const timer = setInterval(() => {
    const value = cgroup.read({ detail: false }).currentBytes;
    if (Number.isFinite(value)) peak = Math.max(peak, value);
  }, 100);
  timer.unref();
  async function child(childRole, childCount, offset = 0) {
    if (aborted) throw Error('Isolated experiment interrupted');
    const script = fileURLToPath(import.meta.url),
      loader = new URL('../../node_modules/tsx/dist/loader.mjs', import.meta.url).href;
    await new Promise((resolve, reject) => {
      const worker = spawn(
        process.execPath,
        [
          '--expose-gc',
          '--import',
          loader,
          script,
          '--role=' + childRole,
          '--count=' + childCount,
          '--offset=' + offset,
          '--idle=' + idle,
          '--directory=' + directory,
        ],
        { cwd: directory, env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
      );
      activeChild = worker;
      let mismatch = false;
      let failure = '';
      worker.stderr.on('data', (chunk) => {
        if (failure.length < 4096) failure += chunk.toString().slice(0, 4096 - failure.length);
      });
      const deadline = setTimeout(
        () => worker.kill('SIGTERM'),
        Math.min(45 * 60000, childCount * (180000 + idle) + 30000),
      );
      worker.on('message', (message) => {
        if (message.kind === 'round_complete') {
          const previous = digests.get(message.fixture);
          if (previous && previous !== message.pipelineDigest) mismatch = true;
          digests.set(message.fixture, message.pipelineDigest);
        }
        const tree = appProcessTree(
          process.pid,
          new Map([
            [process.pid, 'probe_parent'],
            [worker.pid, 'probe_worker'],
          ]),
        );
        output({
          ...message,
          treeCollectedAt: new Date().toISOString(),
          processTree: tree,
          treeRssIsContainerTotal: false,
          cgroup: cgroup.read(),
        });
      });
      worker.once('error', (error) => {
        clearTimeout(deadline);
        reject(error);
      });
      worker.once('exit', (code) => {
        activeChild = undefined;
        clearTimeout(deadline);
        output({
          event: 'native_probe',
          kind: 'child_exit',
          role: childRole,
          code,
          parentRssMB: mb(process.memoryUsage.rss()),
          cgroup: cgroup.read(),
        });
        if (code === 0 && !mismatch) resolve();
        else {
          output({
            event: 'native_probe',
            kind: 'child_failure',
            code: failure.match(/Error \[([A-Z_]+)\]/)?.[1] ?? 'UNSPECIFIED',
          });
          reject(Error('Isolated child failed'));
        }
      });
    });
  }
  output({
    event: 'native_probe',
    kind: 'experiment_start',
    platform: process.platform,
    linuxEvidence: process.platform === 'linux',
    count,
    idleMs: idle,
    allocator: args.jemalloc
      ? 'jemalloc'
      : args.arenas
        ? 'glibc_arenas_' + args.arenas
        : 'system_default',
    network: false,
    production: false,
  });
  try {
    await child('fixtures', 1);
    peak = 0;
    output({ event: 'native_probe', kind: 'mode', mode: 'persistent' });
    await child('worker', count);
    await wait(idle);
    output({
      event: 'native_probe',
      kind: 'mode_end',
      mode: 'persistent',
      maxObservedCgroupMB: peak ? mb(peak) : null,
      cgroup: cgroup.read(),
    });
    peak = 0;
    output({ event: 'native_probe', kind: 'mode', mode: 'one_process_per_image' });
    for (let index = 0; index < count; index++) await child('worker', 1, index);
    await wait(idle);
    output({
      event: 'native_probe',
      kind: 'experiment_end',
      maxObservedCgroupMB: peak ? mb(peak) : null,
      parentRssMB: mb(process.memoryUsage.rss()),
      cgroup: cgroup.read(),
    });
  } finally {
    clearInterval(timer);
  }
}
