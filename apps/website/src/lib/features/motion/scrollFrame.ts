type Write = () => void;
type Read = (time: number) => Write | void;
type Job = { read: Read; version: number };

const pending = new Set<Job>();
let frame = 0;

/** Shared by scroll actions: every geometry read finishes before any style write. */
function flush(time: number) {
  frame = 0;
  const jobs = Array.from(pending, (job) => ({ job, version: job.version }));
  pending.clear();
  const writes: Write[] = [];
  const safely = (callback: () => void) => {
    try {
      callback();
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }
  };
  for (const { job, version } of jobs) {
    if (job.version !== version) continue;
    safely(() => {
      const write = job.read(time);
      if (write)
        writes.push(() => {
          if (job.version === version) write();
        });
    });
  }
  for (const write of writes) safely(write);
}

export function scrollFrame(read: Read) {
  const job: Job = { read, version: 0 };
  const cancel = () => {
    job.version++;
    pending.delete(job);
    if (!pending.size && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  return {
    schedule() {
      pending.add(job);
      if (!frame) frame = requestAnimationFrame(flush);
    },
    cancel,
    // Initialization/restoration must reconcile the pose before the next paint.
    runNow(time: number) {
      cancel();
      read(time)?.();
    },
  };
}

/** Reading an inline declaration does not force computed style or geometry. */
export function setScrollStyle(node: HTMLElement, name: string, value: string) {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
}
