import { afterEach, expect, it, vi } from 'vitest';
import { photoRail } from './photoRail';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
});
function setup(index = 0) {
  const reduced = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', () => reduced);
  const computed = vi.fn(() => ({ transform: 'matrix(1, 0, 0, 1, -150, 0)' }));
  vi.stubGlobal('getComputedStyle', computed);
  let resize: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const moves: { finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const node = {
    clientWidth: 300,
    style: { transform: '' },
    dataset: {} as Record<string, string>,
    animate: vi.fn((_frames: Keyframe[], _options: KeyframeAnimationOptions) => {
      let finish!: () => void;
      let reject!: () => void;
      const finished = new Promise<void>((resolve, fail) => {
        finish = resolve;
        reject = fail;
      });
      const cancel = vi.fn(() => reject());
      moves.push({ finish, cancel });
      return { finished, cancel };
    }),
  };
  const action = photoRail(node as unknown as HTMLElement, { index, count: 12 });
  cleanup = action.destroy;
  return {
    node,
    action,
    reduced,
    computed,
    moves,
    disconnect,
    resize: (width: number) =>
      resize([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver),
  };
}

it('opens directly at the selected image and moves the entire contiguous strip to a distant thumbnail', async () => {
  const { node, action, moves, computed } = setup(2);
  expect(node.style.transform).toBe('translate3d(-200%, 0, 0)');
  expect(node.animate).not.toHaveBeenCalled();
  action.update({ index: 6, count: 12 });
  expect(node.animate).toHaveBeenCalledWith(
    [{ transform: 'translate3d(-200%, 0, 0)' }, { transform: 'translate3d(-600%, 0, 0)' }],
    expect.objectContaining({ duration: 720 }),
  );
  expect(node.dataset.moving).toBe('true');
  expect(computed).not.toHaveBeenCalled();
  moves[0]!.finish();
  await Promise.resolve();
  await Promise.resolve();
  expect(node.dataset.moving).toBe('false');
});

it('continues an interrupted selection from the visible transform and ignores stale completions', async () => {
  const { node, action, moves, computed } = setup();
  action.update({ index: 5, count: 12 });
  action.update({ index: 1, count: 12 });
  expect(computed).toHaveBeenCalledOnce();
  expect(moves[0]!.cancel).toHaveBeenCalledOnce();
  expect(node.animate.mock.calls[1]?.[0]).toEqual([
    { transform: 'matrix(1, 0, 0, 1, -150, 0)' },
    { transform: 'translate3d(-100%, 0, 0)' },
  ]);
  await Promise.resolve();
  await Promise.resolve();
  expect(node.dataset.moving).toBe('true');
});

it('uses an immediate bounded selection for reduced motion', () => {
  const { node, action, reduced } = setup();
  reduced.matches = true;
  action.update({ index: 99, count: 12 });
  expect(node.style.transform).toBe('translate3d(-1100%, 0, 0)');
  expect(node.animate).not.toHaveBeenCalled();
  expect(node.dataset.moving).toBe('false');
});

it('cancels movement when resized or reduced motion is enabled', () => {
  const { node, action, reduced, resize, moves } = setup();
  action.update({ index: 4, count: 12 });
  resize(400);
  expect(moves[0]!.cancel).toHaveBeenCalledOnce();
  expect(node.style.transform).toBe('translate3d(-400%, 0, 0)');
  action.update({ index: 2, count: 12 });
  reduced.matches = true;
  reduced.dispatchEvent(new Event('change'));
  expect(moves[1]!.cancel).toHaveBeenCalledOnce();
  expect(node.dataset.moving).toBe('false');
});

it('does no new work for unchanged selection and tears down the active animation', () => {
  const { node, action, moves, disconnect } = setup();
  action.update({ index: 0, count: 12 });
  expect(node.animate).not.toHaveBeenCalled();
  action.update({ index: 1, count: 12 });
  action.destroy();
  cleanup = undefined;
  expect(moves[0]!.cancel).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
});
