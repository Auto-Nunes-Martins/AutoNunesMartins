import { createCgroupReader } from './containerMemory.mjs';

/** One bounded console entry per minute. No history, DB, process inspection or IPC. */
export function startMemoryHeartbeat({
  read = createCgroupReader(),
  rss = () => process.memoryUsage.rss(),
  log = (entry) => console.info(JSON.stringify(entry)),
  every = setInterval,
  cancel = clearInterval,
} = {}) {
  const timer = every(() => {
    try {
      const memory = read.read({ detail: false });
      const entry = { event: 'memory_health', rssBytes: rss() };
      if (memory.available) {
        for (const [key, value] of [
          ['containerBytes', memory.currentBytes],
          ['containerLimitBytes', memory.effectiveLimitBytes ?? memory.limitBytes],
        ])
          if (Number.isSafeInteger(value) && value >= 0) entry[key] = value;
      }
      log(entry);
    } catch {
      /* Monitoring must never affect service availability. */
    }
  }, 60_000);
  timer.unref?.();
  return () => cancel(timer);
}
