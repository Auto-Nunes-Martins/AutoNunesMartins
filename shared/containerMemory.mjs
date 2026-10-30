import { readFileSync } from 'node:fs';
import path from 'node:path';

const integer = (value) =>
  /^\d+$/.test(String(value).trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const finiteLimit = (value) => {
  const n = integer(value);
  return n !== null && n >= 0 && n < 2 ** 60 ? n : null;
};
const clean = (p) =>
  typeof p === 'string' && p.startsWith('/') && !p.split('/').includes('..') && !p.includes('\0');
const unescape = (p) =>
  p.replace(/\\(040|011|012|134)/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
export function resolveMemoryCgroup(membership, mountinfo) {
  const groups = membership.split('\n').map((line) => line.split(':'));
  const legacyMemory = groups.some((parts) => parts[1]?.split(',').includes('memory'));
  for (const line of mountinfo.split('\n')) {
    const [left, right] = line.split(' - ');
    if (!right) continue;
    const before = left.split(' '),
      after = right.split(' '),
      type = after[0];
    if (type === 'cgroup2' && legacyMemory) continue;
    if (
      type !== 'cgroup2' &&
      !(type === 'cgroup' && after.slice(1).join(',').split(',').includes('memory'))
    )
      continue;
    const group = groups.find((parts) =>
      type === 'cgroup2'
        ? parts[0] === '0' && parts[1] === ''
        : parts[1]?.split(',').includes('memory'),
    );
    if (!group) continue;
    const root = unescape(before[3] ?? ''),
      mount = unescape(before[4] ?? ''),
      member = group.slice(2).join(':');
    if (!clean(root) || !clean(mount) || !clean(member)) continue;
    // A cgroup namespace may expose membership '/' while the mount root names its host path.
    const relative =
      member === '/'
        ? ''
        : member === root
          ? ''
          : member.startsWith(root === '/' ? '/' : root + '/')
            ? member.slice(root === '/' ? 1 : root.length + 1)
            : null;
    if (relative === null) continue;
    const directory = path.posix.join(mount, relative);
    if (directory !== mount && !directory.startsWith(mount + '/')) continue;
    return { version: type === 'cgroup2' ? 2 : 1, directory, mount };
  }
  return null;
}
/** Only this process's cgroup and bounded ancestors. Never substitutes host free RAM for quota. */
export function createCgroupReader({
  platform = process.platform,
  read = (filename) => readFileSync(filename, 'utf8'),
} = {}) {
  let location;
  const text = (file) => {
    try {
      const value = read(file);
      return typeof value === 'string' && value.length <= 262144 ? value.trim() : null;
    } catch {
      return null;
    }
  };
  return {
    read({ detail = true } = {}) {
      if (platform !== 'linux')
        return {
          available: false,
          reason: 'unsupported_platform',
          scope: 'unavailable',
          currentBytes: null,
          limitBytes: null,
          headroomBytes: null,
        };
      if (!location) {
        const member = text('/proc/self/cgroup'),
          mount = text('/proc/self/mountinfo');
        if (member === null || mount === null)
          return { available: false, reason: 'membership_unreadable', scope: 'unavailable' };
        location = resolveMemoryCgroup(member, mount);
      }
      if (!location)
        return { available: false, reason: 'memory_controller_unresolved', scope: 'unavailable' };
      const v2 = location.version === 2,
        currentName = v2 ? 'memory.current' : 'memory.usage_in_bytes',
        limitName = v2 ? 'memory.max' : 'memory.limit_in_bytes',
        peakName = v2 ? 'memory.peak' : 'memory.max_usage_in_bytes';
      const current = integer(text(location.directory + '/' + currentName)),
        limitText = text(location.directory + '/' + limitName),
        limit = finiteLimit(limitText),
        peak = integer(text(location.directory + '/' + peakName));
      if (current === null)
        return {
          available: false,
          reason: 'usage_unreadable',
          controller: v2 ? 'v2' : 'v1',
          scope: 'cgroup',
        };
      const constraints = [];
      let directory = location.directory;
      let ancestorComplete = false,
        ancestorUnreadable = false;
      for (let level = 0; level < (detail ? 8 : 1); level++) {
        const usage = level === 0 ? current : integer(text(directory + '/' + currentName)),
          maxText = level === 0 ? limitText : text(directory + '/' + limitName),
          max = finiteLimit(maxText);
        if (max !== null && usage !== null)
          constraints.push({
            level,
            currentBytes: usage,
            limitBytes: max,
            headroomBytes: Math.max(0, max - usage),
            overLimitBytes: Math.max(0, usage - max),
          });
        if (usage === null || maxText === null) ancestorUnreadable = true;
        if (directory === location.mount) {
          ancestorComplete = true;
          break;
        }
        const parent = path.posix.dirname(directory);
        if (parent !== location.mount && !parent.startsWith(location.mount + '/')) break;
        directory = parent;
      }
      const effective = constraints.reduce(
        (a, b) => (!a || b.headroomBytes < a.headroomBytes ? b : a),
        null,
      );
      const result = {
        available: true,
        scope: 'cgroup',
        controller: v2 ? 'v2' : 'v1',
        currentBytes: current,
        limitBytes: limit,
        limitStatus:
          limit !== null
            ? 'finite'
            : limitText === null
              ? 'unreadable'
              : 'unlimited_or_unrepresentable',
        peakBytes: peak,
        peakScope: 'cgroup_lifetime',
        headroomBytes: limit === null ? null : Math.max(0, limit - current),
        overLimitBytes: limit === null ? null : Math.max(0, current - limit),
        effectiveLimitBytes: effective?.limitBytes ?? null,
        effectiveHeadroomBytes: effective?.headroomBytes ?? null,
        limitScope: effective ? (effective.level === 0 ? 'self' : 'ancestor') : null,
        constraints,
        ancestorScanComplete: ancestorComplete && !ancestorUnreadable,
        ancestorScanBounded: !ancestorComplete,
        headroomScope: 'observed_visible_constraints_only',
        hostMemoryUsedAsQuota: false,
      };
      if (detail) {
        const stat = {};
        for (const line of (text(location.directory + '/memory.stat') ?? '').split('\n')) {
          const [key, value] = line.trim().split(/\s+/);
          if (/^[a-z_]+$/.test(key) && integer(value) !== null) stat[key] = integer(value);
        }
        result.components = {
          anonBytes: v2 ? (stat.anon ?? null) : (stat.total_rss ?? stat.rss ?? null),
          fileBytes: v2 ? (stat.file ?? null) : (stat.total_cache ?? stat.cache ?? null),
          kernelBytes: v2
            ? (stat.kernel ?? null)
            : integer(text(location.directory + '/memory.kmem.usage_in_bytes')),
          socketBytes: stat.sock ?? null,
          slabBytes: stat.slab ?? null,
          kernelStackBytes: stat.kernel_stack ?? null,
          pageTablesBytes: stat.pagetables ?? null,
        };
        result.componentNote =
          'Counters may overlap or be sampled at different instants; not an exact byte attribution.';
      }
      return result;
    },
  };
}
