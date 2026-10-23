import { describe, expect, it, vi } from 'vitest';
import { automaticDraft, activeDraftGuard, registerDraftGuard } from './automaticDraft';

describe('automatic vehicle recovery drafts', () => {
  it('protects newer edits only after their own write completes', async () => {
    let text = 'initial';
    let release!: () => void;
    const saved: string[] = [];
    const protectedState = vi.fn();
    const draft = automaticDraft({ capture: () => text,
      persist: async value => { saved.push(value); if (saved.length === 1) await new Promise<void>(resolve => { release = resolve; }); },
      remove: async () => {}, protected: protectedState, state: () => {},
    });
    text = 'first';
    const writing = draft.flush();
    text = 'newer';
    expect(protectedState).not.toHaveBeenCalled();
    release();
    await writing;
    expect(saved).toEqual(['first', 'newer']);
    expect(protectedState).toHaveBeenCalledTimes(1);
    await draft.flush();
    expect(saved).toHaveLength(2);
  });

  it('keeps a failed write pending and permits a real retry', async () => {
    let text = 'initial';
    const persist = vi.fn().mockRejectedValueOnce(Error('Quota')).mockResolvedValue(undefined);
    const state = vi.fn(), protectedState = vi.fn();
    const draft = automaticDraft({ capture: () => text, persist, remove: async () => {}, protected: protectedState, state });
    text = 'edited';
    await expect(draft.flush()).rejects.toThrow('Quota');
    expect(state).toHaveBeenLastCalledWith('error');
    expect(protectedState).not.toHaveBeenCalled();
    await draft.flush();
    expect(persist).toHaveBeenCalledTimes(2);
    expect(state).toHaveBeenLastCalledWith('saved');
  });

  it('waits for a pending write before removing a completed or discarded draft', async () => {
    let value = 0;
    let release!: () => void;
    const events: string[] = [];
    const draft = automaticDraft({ capture: () => value,
      persist: async () => { await new Promise<void>(resolve => { release = resolve; }); events.push('write'); },
      remove: async () => { events.push('remove'); }, protected: () => {}, state: () => {},
    });
    value = 1;
    const writing = draft.flush();
    const clearing = draft.discard();
    release();
    await Promise.all([writing, clearing]);
    expect(events).toEqual(['write', 'remove']);
    await draft.flush();
    expect(events).toHaveLength(2);
  });

  it('does not let a stale component unregister the current page guard', () => {
    const first = { flush: async () => {}, discard: async () => {} };
    const second = { ...first };
    const removeFirst = registerDraftGuard(first);
    const removeSecond = registerDraftGuard(second);
    removeFirst();
    expect(activeDraftGuard()).toBe(second);
    removeSecond();
    expect(activeDraftGuard()).toBeUndefined();
  });

  it('leaves the last protected copy intact when abandoning failed newer changes', async () => {
    let text = 'initial';
    const persist = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('Offline'));
    const remove = vi.fn();
    const draft = automaticDraft({ capture: () => text, persist, remove, protected: () => {}, state: () => {} });
    text = 'protected';
    await draft.flush();
    text = 'unprotected';
    await expect(draft.flush()).rejects.toThrow();
    await draft.abandon();
    expect(remove).not.toHaveBeenCalled();
    await draft.flush();
    expect(persist).toHaveBeenCalledTimes(2);
  });
});
