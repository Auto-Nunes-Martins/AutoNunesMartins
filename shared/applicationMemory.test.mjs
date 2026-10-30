import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createCgroupReader, resolveMemoryCgroup } from './containerMemory.mjs';
import { ApplicationMemoryMonitor, appProcessTree, snapshotChannel } from './applicationMemory.mjs';
const mount = '1 0 0:1 / /cg rw - cgroup2 cgroup rw';
const fixture = (files, platform = 'linux') =>
  createCgroupReader({
    platform,
    read: (file) => {
      if (!(file in files)) throw Error('denied');
      return files[file];
    },
  });
test('v2 nested cgroup, ancestors, components and true quota headroom', () => {
  const reader = fixture({
    '/proc/self/cgroup': '0::/app',
    '/proc/self/mountinfo': mount,
    '/cg/app/memory.current': '200000000',
    '/cg/app/memory.max': '512000000',
    '/cg/app/memory.peak': '300000000',
    '/cg/app/memory.stat': 'anon 120000000\nfile 70000000\nkernel 10000000\nslab 3000000',
    '/cg/memory.current': '490000000',
    '/cg/memory.max': '512000000',
  });
  const c = reader.read();
  assert.equal(c.currentBytes, 200000000);
  assert.equal(c.headroomBytes, 312000000);
  assert.equal(c.effectiveHeadroomBytes, 22000000);
  assert.equal(c.limitScope, 'ancestor');
  assert.equal(c.components.fileBytes, 70000000);
  assert.equal(c.peakBytes, 300000000);
  assert.equal(c.hostMemoryUsedAsQuota, false);
});
test('v1 memory controller and namespace mount roots resolve without host memory fallback', () => {
  const c = fixture({
    '/proc/self/cgroup': '5:cpu,memory:/docker/app',
    '/proc/self/mountinfo': '2 0 0:2 /docker /cg rw - cgroup cgroup rw,memory',
    '/cg/app/memory.usage_in_bytes': '100',
    '/cg/app/memory.limit_in_bytes': '9223372036854771712',
    '/cg/app/memory.max_usage_in_bytes': '150',
    '/cg/app/memory.stat': 'total_rss 60\ntotal_cache 30',
  }).read();
  assert.equal(c.controller, 'v1');
  assert.equal(c.limitBytes, null);
  assert.equal(c.headroomBytes, null);
  assert.equal(c.components.anonBytes, 60);
  assert.equal(
    resolveMemoryCgroup('0::/', '1 0 0:1 /docker/app /cg rw - cgroup2 cgroup rw').directory,
    '/cg',
  );
  assert.equal(resolveMemoryCgroup('0::/../secret', mount), null);
  assert.equal(
    resolveMemoryCgroup(
      '0::/\n5:memory:/docker/app',
      mount + '\n2 0 0:2 /docker /legacy rw - cgroup cgroup rw,memory',
    ).directory,
    '/legacy/app',
  );
});
test('missing, unlimited, zero limits, permissions and Windows stay explicit', () => {
  assert.equal(fixture({}).read().reason, 'membership_unreadable');
  assert.equal(fixture({}, 'win32').read().reason, 'unsupported_platform');
  const files = {
    '/proc/self/cgroup': '0::/',
    '/proc/self/mountinfo': mount,
    '/cg/memory.current': '12',
    '/cg/memory.max': 'max',
  };
  assert.equal(fixture(files).read().effectiveHeadroomBytes, null);
  assert.equal(fixture(files).read().peakBytes, null);
  delete files['/cg/memory.max'];
  assert.equal(fixture(files).read().limitStatus, 'unreadable');
  files['/cg/memory.max'] = '0';
  assert.equal(fixture(files).read().overLimitBytes, 12);
  delete files['/cg/memory.current'];
  assert.equal(fixture(files).read().reason, 'usage_unreadable');
  const deep = { '/proc/self/cgroup': '0::/a/b/c/d/e/f/g/h', '/proc/self/mountinfo': mount };
  for (let count = 0; count <= 8; count++) {
    const dir =
      '/cg' +
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
        .slice(0, count)
        .map((p) => '/' + p)
        .join('');
    deep[dir + '/memory.current'] = '1';
    deep[dir + '/memory.max'] = 'max';
  }
  const bounded = fixture(deep).read();
  assert.equal(bounded.ancestorScanComplete, false);
  assert.equal(bounded.ancestorScanBounded, true);
});
function stat(pid, start) {
  const fields = Array(22).fill('0');
  fields[0] = 'S';
  fields[11] = '40';
  fields[12] = '5';
  fields[19] = String(start);
  return `${pid} (private process name) ${fields.join(' ')}`;
}
test('Linux inventory traverses only app children, bounds discovery and survives process churn', () => {
  const reads = [],
    files = {
      '/proc/10/stat': stat(10, 1),
      '/proc/10/status': 'VmRSS: 100 kB',
      '/proc/10/task/10/children': '11 12',
      '/proc/11/stat': stat(11, 9),
      '/proc/11/status': 'VmRSS: 50 kB',
      '/proc/11/task/11/children': '',
    };
  const tree = appProcessTree(
    10,
    new Map([
      [10, 'gateway'],
      [11, 'backend'],
    ]),
    {
      platform: 'linux',
      maxProcesses: 2,
      read: (file) => {
        reads.push(file);
        if (!(file in files)) throw Error();
        return files[file];
      },
    },
  );
  assert.equal(tree.processes.length, 2);
  assert.equal(tree.limited, true);
  assert.equal(tree.processes[1].identity, '11:9');
  assert.equal(tree.processes[1].rss, 51200);
  assert.ok(reads.every((file) => /^\/proc\/(10|11)\//.test(file)));
  assert.ok(!JSON.stringify(tree).includes('private'));
  assert.equal(
    appProcessTree(10, new Map(), {
      platform: 'win32',
      read: () => {
        throw Error('must not enumerate');
      },
    }).processes.length,
    0,
  );
});
function child(pid) {
  const c = new EventEmitter();
  c.pid = pid;
  c.connected = true;
  c.boot = randomUUID();
  c.send = (message, callback) => {
    callback?.();
    queueMicrotask(() =>
      c.emit('message', {
        type: 'anm:memory:snapshot',
        collection: message.collection,
        snapshot: {
          pid,
          service: 'backend',
          boot: c.boot,
          rss: 80,
          heapUsed: 30,
          sampledAtEpochMs: Date.now(),
          private: 'hidden',
        },
      }),
    );
  };
  return c;
}
test('IPC accepts only correlated identities and removes its bounded listeners', async () => {
  const c = child(22),
    channel = snapshotChannel(c, 'backend');
  const sample = await channel.request(randomUUID());
  assert.equal(sample.rss, 80);
  assert.equal(sample.private, undefined);
  assert.equal(c.listenerCount('message'), 1);
  channel.stop();
  assert.equal(c.listenerCount('message'), 0);
  assert.equal(c.listenerCount('exit'), 0);
});
test('IPC rejects mismatched PID and has one bounded pending request with timeout', async () => {
  const c = child(22);
  c.send = (_message, callback) => {
    callback?.();
  };
  const channel = snapshotChannel(c, 'backend', { timeoutMs: 10 }),
    keep = setTimeout(() => {}, 1000),
    id = randomUUID();
  try {
    const pending = channel.request(id);
    assert.equal(await channel.request(randomUUID()), null);
    c.emit('message', { type: 'anm:memory:snapshot', collection: randomUUID(), snapshot: {} });
    assert.equal(await pending, null);
    const second = channel.request(id);
    c.emit('message', {
      type: 'anm:memory:snapshot',
      collection: id,
      snapshot: {
        pid: 99,
        service: 'backend',
        boot: randomUUID(),
        rss: 80,
        sampledAtEpochMs: Date.now(),
      },
    });
    assert.equal(await second, null);
  } finally {
    channel.stop();
    clearTimeout(keep);
  }
});
test('real application preload answers private IPC with cooperative heap, then exits cleanly', async () => {
  const c = spawn(
    process.execPath,
    [
      '--import',
      './deployment/diagnostics-preload.mjs',
      '--input-type=module',
      '-e',
      "const timer=setInterval(()=>{},1000);process.on('message',m=>{if(m==='test-stop'){clearInterval(timer);process.disconnect();}});process.send({ready:true});",
    ],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: {
        ...process.env,
        RUNTIME_DIAGNOSTICS: 'true',
        RUNTIME_DIAGNOSTICS_MANAGED: 'true',
        RUNTIME_DIAGNOSTICS_SERVICE: 'backend',
      },
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
  );
  const channel = snapshotChannel(c, 'backend');
  try {
    await once(c, 'message');
    const snapshot = await channel.request(randomUUID());
    assert.equal(snapshot.pid, c.pid);
    assert.ok(snapshot.heapUsed > 0);
    assert.ok(snapshot.rss > snapshot.heapUsed);
  } finally {
    channel.stop();
    const ended = once(c, 'exit');
    c.send('test-stop');
    await ended;
  }
});
test('IPC backpressure never creates a queue after a request times out', async () => {
  const c = child(22);
  let sends = 0,
    ack;
  c.send = (_message, callback) => {
    sends++;
    ack = callback;
    return false;
  };
  const channel = snapshotChannel(c, 'backend', { timeoutMs: 10 }),
    keep = setTimeout(() => {}, 1000);
  try {
    assert.equal(await channel.request(randomUUID()), null);
    assert.equal(await channel.request(randomUUID()), null);
    assert.equal(sends, 1);
    ack();
    const pending = channel.request(randomUUID());
    c.emit('exit');
    assert.equal(await pending, null);
    assert.equal(sends, 2);
  } finally {
    channel.stop();
    clearTimeout(keep);
  }
});
test('aligned collection keeps quota total separate from overlapping RSS, trends, PID reuse and opt-out', async () => {
  let now = 100000,
    rss = 100;
  const rows = [],
    timers = new Set(),
    boot = randomUUID(),
    diagnostics = {
      enabled: true,
      capture: () => ({
        pid: 10,
        service: 'gateway',
        boot,
        instance: boot,
        rss,
        heapUsed: 20,
        sampledAtEpochMs: now,
      }),
    };
  const monitor = new ApplicationMemoryMonitor({
    diagnostics,
    platform: 'win32',
    now: () => now,
    container: {
      read: () => ({ currentBytes: 150, limitBytes: 512, effectiveHeadroomBytes: 362 }),
    },
    sink: (row) => rows.push(structuredClone(row)),
    interval: (fn) => {
      timers.add(fn);
      return { unref() {} };
    },
    clear: () => timers.clear(),
  });
  const c = child(22);
  monitor.register('backend', c);
  await monitor.collect();
  assert.equal(rows[0].sumProcessRssBytes, 180);
  assert.equal(rows[0].cgroup.currentBytes, 150);
  assert.equal(rows[0].sumProcessRssIsContainerTotal, false);
  assert.equal(rows[0].baselineNormality, 'not_determined');
  assert.equal(rows[0].stage, 'startup');
  monitor.ready();
  now += 1000;
  rss = 130;
  await monitor.collect();
  assert.equal(rows[1].stage, 'warmup');
  assert.equal(rows[1].processes[0].baselineTrend.deltaRss, 30);
  c.boot = randomUUID();
  now += 61000;
  await monitor.collect();
  assert.equal(rows[2].changes.exited.length, 1);
  assert.equal(rows[2].changes.started.length, 1);
  assert.equal(rows[2].stage, 'idle');
  monitor.stop();
  assert.equal(timers.size, 0);
  assert.equal(c.listenerCount('message'), 0);
  assert.equal(monitor.trends.size, 0);
  const off = new ApplicationMemoryMonitor({
    diagnostics: { enabled: false },
    interval: () => {
      throw Error('disabled');
    },
    sink: () => {
      throw Error('disabled');
    },
  });
  await off.collect();
  off.stop();
});
