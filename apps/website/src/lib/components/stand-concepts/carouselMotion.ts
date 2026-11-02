/** Continue the drag's painted transform through settling without switching
 * the parent to a separate compositor animation for its positioned controls. */
export function carouselMotion(
  track: HTMLElement,
  from: number,
  to: number,
  duration: number,
  curve: readonly [number, number, number, number],
) {
  let frame = 0,
    done = false;
  let resolve!: () => void, reject!: (reason: Error) => void;
  const finished = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const started = performance.now();
  const cubic = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  const ease = (progress: number) => {
    if (progress === 0 || progress === 1) return progress;
    let low = 0,
      high = 1;
    for (let i = 0; i < 12; i++) {
      const middle = (low + high) / 2;
      if (cubic(middle, curve[0], curve[2]) < progress) low = middle;
      else high = middle;
    }
    return cubic((low + high) / 2, curve[1], curve[3]);
  };
  const paint = (progress: number) => {
    track.style.transform = `translate3d(${from + (to - from) * ease(progress)}px, 0, 0)`;
  };
  const tick = (now: number) => {
    if (done) return;
    const progress = duration > 0 ? Math.min(1, Math.max(0, (now - started) / duration)) : 1;
    paint(progress);
    if (progress === 1) {
      done = true;
      resolve();
    } else frame = requestAnimationFrame(tick);
  };
  paint(0);
  if (duration === 0) tick(started);
  else frame = requestAnimationFrame(tick);
  return {
    finished,
    cancel() {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      reject(new Error('Carousel motion cancelled'));
    },
  };
}
