type Subscriber = {
  update: (now: number, resumed: boolean) => void;
  visible: boolean;
  cadence: number;
  offset: number;
  bucket: number;
};

const subscribers = new Map<Element, Subscriber>();
let observer: IntersectionObserver | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function publish(subscriber: Subscriber, now: number, resumed: boolean) {
  const bucket = Math.floor((now - subscriber.offset) / subscriber.cadence);
  if (resumed || bucket !== subscriber.bucket) {
    subscriber.bucket = bucket;
    subscriber.update(now, resumed);
  }
}

function schedule() {
  clearTimeout(timer);
  timer = undefined;
  if (document.hidden) return;
  const now = Date.now();
  let delay = Infinity;
  for (const subscriber of subscribers.values()) {
    if (!subscriber.visible) continue;
    const remainder =
      (((now - subscriber.offset) % subscriber.cadence) + subscriber.cadence) % subscriber.cadence;
    delay = Math.min(delay, subscriber.cadence - remainder);
  }
  if (!Number.isFinite(delay)) return;
  timer = setTimeout(() => {
    timer = undefined;
    if (!document.hidden) {
      const current = Date.now();
      for (const subscriber of subscribers.values()) {
        if (subscriber.visible) publish(subscriber, current, false);
      }
    }
    schedule();
  }, delay);
}

function visibilityChanged() {
  if (!document.hidden) {
    const now = Date.now();
    for (const subscriber of subscribers.values()) {
      if (subscriber.visible) publish(subscriber, now, true);
    }
  }
  schedule();
}

/** One clock for visible countdowns. Re-entry uses wall time, never accumulated ticks. */
export function visibleClock(
  node: Element,
  update: Subscriber['update'],
  cadence = 1000,
  offset = 0,
) {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const subscriber = subscribers.get(entry.target);
          if (!subscriber) continue;
          const resumed = entry.isIntersecting && !subscriber.visible;
          subscriber.visible = entry.isIntersecting;
          if (resumed && !document.hidden) publish(subscriber, now, true);
        }
        schedule();
      },
      { rootMargin: '200px 0px' },
    );
    document.addEventListener('visibilitychange', visibilityChanged);
  }
  const subscriber: Subscriber = { update, cadence, offset, visible: false, bucket: NaN };
  subscribers.set(node, subscriber);
  // Hydrate once, including offscreen cards; recurring work only starts near the viewport.
  publish(subscriber, Date.now(), true);
  observer.observe(node);
  return () => {
    observer?.unobserve(node);
    subscribers.delete(node);
    if (!subscribers.size) {
      observer?.disconnect();
      observer = undefined;
      document.removeEventListener('visibilitychange', visibilityChanged);
    }
    schedule();
  };
}
