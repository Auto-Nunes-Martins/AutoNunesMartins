// Read-only Linux /proc snapshot. No environment enumeration, commands or image reads.
// Run in the running Render service, not an ephemeral instance, with its verified gateway PID.
import fs from 'node:fs';

const started = performance.now();
const gateway = Number(process.argv[2]);
const mib = value => Math.round(value / 1048576 * 100) / 100;
function read(file, cap = 2 * 1024 * 1024) {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(cap + 1);
    let length = 0;
    while (length <= cap) {
      const bytes = fs.readSync(fd, buffer, length, Math.min(65536, cap + 1 - length), null);
      if (!bytes) break;
      length += bytes;
    }
    if (length > cap) throw Error('read_limit');
    return buffer.toString('utf8', 0, length);
  } finally { fs.closeSync(fd); }
}
function role(pid) {
  const args = read(`/proc/${pid}/cmdline`, 16384).split('\0');
  for (const [name, suffix] of [['gateway', 'deployment/start.mjs'], ['gateway', 'deployment/container-start.mjs'], ['gateway', 'deployment/migrate-before-start.mjs'], ['backend', 'backend/dist/index.js'], ['website', 'apps/website/build/index.js'], ['crm', 'apps/crm/build/index.js']])
    if (args.some(arg => arg === suffix || arg.endsWith('/' + suffix))) return name;
}
function numericLines(text) {
  return Object.fromEntries([...text.matchAll(/^([A-Za-z_]+):\s+(\d+) kB$/gm)].map(match => [match[1], Number(match[2]) * 1024]));
}
function descriptors(pid) {
  const names = fs.readdirSync(`/proc/${pid}/fd`);
  if (names.length > 512) return { available: 0, count: names.length, capped: 1 };
  const inodes = new Set(), result = { available: 1, count: names.length, sockets: 0, pipes: 0, anonymous: 0, other: 0, raced: 0 };
  for (const fd of names) {
    try {
      const link = fs.readlinkSync(`/proc/${pid}/fd/${fd}`), socket = /^socket:\[(\d+)\]$/.exec(link);
      if (socket) { result.sockets++; inodes.add(socket[1]); }
      else if (link.startsWith('pipe:')) result.pipes++;
      else if (link.startsWith('anon_inode:')) result.anonymous++;
      else result.other++;
    } catch { result.raced++; }
  }
  const tcp = { established: 0, closeWait: 0, listen: 0, other: 0, unavailable: 0 }, matched = new Set();
  for (const file of ['tcp', 'tcp6']) {
    try {
      for (const line of read(`/proc/${pid}/net/${file}`).trim().split('\n').slice(1)) {
        const fields = line.trim().split(/\s+/);
        if (!inodes.has(fields[9]) || matched.has(fields[9])) continue;
        matched.add(fields[9]);
        tcp[fields[3] === '01' ? 'established' : fields[3] === '08' ? 'closeWait' : fields[3] === '0A' ? 'listen' : 'other']++;
      }
    } catch { tcp.unavailable++; }
  }
  return { ...result, tcp, socketsNotMatchedToTcp: inodes.size - matched.size };
}
function mappingGroups(pid) {
  const groups = {};
  let group;
  for (const line of read(`/proc/${pid}/smaps`).split('\n')) {
    const header = /^[a-f0-9]+-[a-f0-9]+\s+([rwxps-]+)\s+[a-f0-9]+\s+[a-f0-9]+:[a-f0-9]+\s+\d+\s*(.*)$/.exec(line);
    if (header) {
      const label = header[2], key = label === '[heap]' ? 'mainHeap' : label.startsWith('[stack') ? 'stack' :
        (!label || label.startsWith('[anon:')) ? (header[1].startsWith('---') ? 'anonymousNoAccess' : 'anonymousAccessible') :
        label.startsWith('[') ? 'special' : 'fileBacked';
      group = groups[key] ??= { regions: 0, virtualBytes: 0, rssBytes: 0, pssBytes: 0, anonymousBytes: 0, privateDirtyBytes: 0 };
      group.regions++;
    } else if (group) {
      const metric = /^(Size|Rss|Pss|Anonymous|Private_Dirty):\s+(\d+) kB$/.exec(line);
      if (metric) group[{ Size: 'virtualBytes', Rss: 'rssBytes', Pss: 'pssBytes', Anonymous: 'anonymousBytes', Private_Dirty: 'privateDirtyBytes' }[metric[1]]] += Number(metric[2]) * 1024;
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, Object.fromEntries(Object.entries(value).map(([field, n]) => [field === 'regions' ? field : field.replace('Bytes', 'MiB'), field === 'regions' ? n : mib(n)]))]));
}
try {
  if (process.platform !== 'linux' || !Number.isSafeInteger(gateway) || gateway <= 0 || role(gateway) !== 'gateway') throw Error('gateway_not_verified');
  const children = read(`/proc/${gateway}/task/${gateway}/children`, 4096).trim().split(/\s+/).filter(Boolean).map(Number);
  if (children.length > 16) throw Error('unexpected_child_count');
  const processes = [];
  for (const pid of [gateway, ...children]) {
    try {
      const service = role(pid);
      if (!service) continue;
      const status = read(`/proc/${pid}/status`, 32768), stat = read(`/proc/${pid}/stat`, 32768);
      const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/), memory = numericLines(read(`/proc/${pid}/smaps_rollup`, 32768));
      processes.push({ service, pid, ppid: Number(fields[1]), startTicks: fields[19], threads: Number(/^Threads:\s+(\d+)$/m.exec(status)?.[1]),
        rssMiB: mib(memory.Rss), pssMiB: mib(memory.Pss), anonymousMiB: mib(memory.Anonymous), privateDirtyMiB: mib(memory.Private_Dirty),
        descriptors: descriptors(pid), ...(service === 'backend' ? { mappings: mappingGroups(pid) } : {}) });
    } catch { processes.push({ pid, available: 0 }); }
  }
  const release = process.env.RENDER_GIT_COMMIT;
  console.log(JSON.stringify({ time: new Date().toISOString(), gateway, shellRelease: /^[a-f0-9]{40}$/.test(release ?? '') ? release : null,
    kernelBoot: read('/proc/sys/kernel/random/boot_id', 256).trim(), collectorPid: process.pid, collectorRssMiB: mib(process.memoryUsage().rss),
    durationMs: Math.round(performance.now() - started), processes }, null, 2));
} catch (error) { console.log(JSON.stringify({ available: 0, reason: ['gateway_not_verified', 'unexpected_child_count', 'read_limit'].includes(error.message) ? error.message : 'proc_unavailable' })); process.exitCode = 1; }
