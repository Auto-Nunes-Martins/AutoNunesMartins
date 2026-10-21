import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ enhance: vi.fn(), applyAction: vi.fn(), refresh: vi.fn(), rejected: vi.fn() }));
vi.mock('$app/forms', () => ({ enhance: mocks.enhance, applyAction: mocks.applyAction }));
vi.mock('./session', () => ({ refreshCrmSession: mocks.refresh, sessionRejected: mocks.rejected }));
import { enhance } from './enhance';
beforeEach(() => { vi.clearAllMocks(); mocks.refresh.mockResolvedValue('token'); });
describe('authenticated enhanced forms', () => {
  it('cancels before the saving state is entered when token renewal fails', async () => {
    mocks.refresh.mockRejectedValueOnce(new Error('offline'));
    const submit = vi.fn(), cancel = vi.fn();
    enhance({} as HTMLFormElement, submit);
    await mocks.enhance.mock.calls[0]![1]({ cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });
  it('preserves form state even when a callback calls update after an HTTP401', async () => {
    const originalUpdate = vi.fn();
    const callback = vi.fn(async (outcome: any) => outcome.update());
    enhance({} as HTMLFormElement, () => callback);
    const complete = await mocks.enhance.mock.calls[0]![1]({ cancel: vi.fn() });
    await complete({ result: { type: 'error', status: 401, error: { message: 'expired' } }, update: originalUpdate });
    expect(callback.mock.calls[0]![0].result).toMatchObject({ type: 'failure', status: 401 });
    expect(originalUpdate).not.toHaveBeenCalled();
    expect(mocks.applyAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'failure', status: 401 }));
    expect(mocks.rejected).toHaveBeenCalledTimes(1);
  });
  it('retains the normal successful submission lifecycle', async () => {
    const update = vi.fn();
    enhance({} as HTMLFormElement);
    const complete = await mocks.enhance.mock.calls[0]![1]({ cancel: vi.fn() });
    await complete({ result: { type: 'success', status: 200, data: {} }, update });
    expect(update).toHaveBeenCalledWith({ reset: true, invalidateAll: true });
    expect(mocks.applyAction).not.toHaveBeenCalled();
  });
});
