import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCgroupReader, resolveMemoryCgroup } from './containerMemory.mjs';
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
