import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  afterNavigate: vi.fn(),
  onDestroy: vi.fn(),
}));
vi.mock('$app/navigation', () => mocks);
vi.mock('svelte', () => ({ onDestroy: mocks.onDestroy }));

import { filterNavigation } from './filterNavigation';

describe('filter navigation', () => {
  let url: URL;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    url = new URL('https://crm.example/tarefas?page=3&scope=mine');
    mocks.goto.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('merges the latest typed text with an immediate chip change and resets pagination', () => {
    const filters = filterNavigation(() => url);
    filters.set('q', 'doc', true);
    filters.set('q', 'documentos', true);
    filters.set('priority', 'HIGH');
    expect(mocks.goto).toHaveBeenCalledTimes(1);
    const target = new URL(mocks.goto.mock.calls[0]![0]);
    expect(Object.fromEntries(target.searchParams)).toEqual({
      scope: 'mine',
      q: 'documentos',
      priority: 'HIGH',
    });
    vi.advanceTimersByTime(300);
    expect(mocks.goto).toHaveBeenCalledTimes(1);
  });

  it('keeps text typed while the previous search navigation finishes', async () => {
    let finish!: () => void;
    mocks.goto.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const filters = filterNavigation(() => url);
    filters.set('q', 'doc', true);
    vi.advanceTimersByTime(250);
    const first = new URL(mocks.goto.mock.calls[0]![0]);
    filters.set('q', 'documentos', true);
    url = first;
    mocks.afterNavigate.mock.calls[0]![0]({ type: 'goto', to: { url: first } });
    finish();
    await Promise.resolve();
    vi.advanceTimersByTime(250);
    expect(mocks.goto).toHaveBeenCalledTimes(2);
    expect(new URL(mocks.goto.mock.calls[1]![0]).searchParams.get('q')).toBe('documentos');
  });

  it('cancels pending typing when using browser history', () => {
    const filters = filterNavigation(() => url);
    filters.set('q', 'doc', true);
    mocks.afterNavigate.mock.calls[0]![0]({
      type: 'popstate',
      to: { url: new URL('https://crm.example/tarefas') },
    });
    vi.advanceTimersByTime(300);
    expect(mocks.goto).not.toHaveBeenCalled();
  });

  it('does not revive a pending query after clearing filters', () => {
    const filters = filterNavigation(() => url);
    filters.set('q', 'doc', true);
    filters.clear();
    vi.advanceTimersByTime(300);
    expect(mocks.goto).toHaveBeenCalledTimes(1);
    expect(mocks.goto.mock.calls[0]![0]).toBe('/tarefas');
  });
});
