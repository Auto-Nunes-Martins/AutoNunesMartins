import { afterEach, expect, it, vi } from 'vitest';
import { carouselMotion } from './carouselMotion';
afterEach(() => vi.unstubAllGlobals());
function setup(duration = 400) {
  let callback: FrameRequestCallback;
  vi.stubGlobal('performance', { now: () => 0 });
  vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => {
    callback = next;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const track = { style: { transform: '' } };
  const motion = carouselMotion(track as unknown as HTMLElement, 100, 0, duration, [0, 0, 1, 1]);
  return { motion, track, cancel, advance: (time: number) => callback(time) };
}
it('settles with painted transforms every frame without a parent Web Animation', async () => {
  const t = setup();
  expect(t.track.style.transform).toBe('translate3d(100px, 0, 0)');
  t.advance(200);
  expect(parseFloat(t.track.style.transform.slice(12))).toBeCloseTo(50, 1);
  t.advance(400);
  await t.motion.finished;
  expect(t.track.style.transform).toBe('translate3d(0px, 0, 0)');
});
it('cancels without a stale frame changing the next movement', async () => {
  const t = setup();
  const failure = expect(t.motion.finished).rejects.toThrow('cancelled');
  t.advance(100);
  const pose = t.track.style.transform;
  t.motion.cancel();
  t.advance(400);
  await failure;
  expect(t.track.style.transform).toBe(pose);
  expect(t.cancel).toHaveBeenCalled();
});
it('keeps reduced-motion settling immediate', async () => {
  const t = setup(0);
  await t.motion.finished;
  expect(t.track.style.transform).toBe('translate3d(0px, 0, 0)');
});
