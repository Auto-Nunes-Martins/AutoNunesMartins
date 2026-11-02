import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
const network = vi.hoisted(() => ({ fetch: vi.fn(), clear: vi.fn() }));
vi.mock('$lib/auth/session', () => ({ sessionFetch: network.fetch }));
vi.mock('$lib/lists/navigationCache', () => ({ listNavigationCache: { clear: network.clear } }));
import {
  rememberCreatedDraft,
  isNewCreation,
  forgetCreation,
  discardVehicleDraft,
  draftNotificationsRevision,
} from './creationLifecycle';
let stored: Map<string, string>, navigation: string;
const id = 'c' + 'a'.repeat(24);
beforeEach(() => {
  stored = new Map();
  navigation = 'navigate';
  vi.clearAllMocks();
  vi.stubGlobal('window', { location: { origin: 'https://fixture' } });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  vi.stubGlobal('performance', { getEntriesByType: () => [{ type: navigation }] });
  forgetCreation('owner', id);
});
afterEach(() => {
  forgetCreation('owner', id);
  vi.unstubAllGlobals();
});
it('does not infer a new creation from its ID; only the successful create redirect records it', () => {
  expect(isNewCreation('owner', id)).toBe(false);
  rememberCreatedDraft('owner', '/viaturas/nova?viatura=' + id);
  expect(isNewCreation('owner', id)).toBe(true);
  expect(isNewCreation('another-owner', id)).toBe(false);
  forgetCreation('owner', id);
  expect(isNewCreation('owner', id)).toBe(false);
});
it('reload restores genuine session provenance; direct/copied-tab navigation clears inherited provenance', () => {
  const key = `anm:new-creation:owner:${id}`;
  stored.set(key, '1');
  navigation = 'reload';
  expect(isNewCreation('owner', id)).toBe(true);
  navigation = 'navigate';
  expect(isNewCreation('owner', id)).toBe(false);
  navigation = 'reload';
  expect(isNewCreation('owner', id)).toBe(false);
});
it.each([403, 409, 503])('keeps lists/notification state on failed discard %s', async (status) => {
  network.fetch.mockResolvedValue(
    new Response(JSON.stringify({ error: 'Preservado' }), { status }),
  );
  const revision = get(draftNotificationsRevision);
  await expect(discardVehicleDraft(id)).rejects.toThrow();
  expect(get(draftNotificationsRevision)).toBe(revision);
  expect(network.clear).not.toHaveBeenCalled();
});
it('invalidates lists and notifications only after confirmed deletion and sends the expected version', async () => {
  network.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  const revision = get(draftNotificationsRevision);
  await discardVehicleDraft(id, '2026-11-01T00:00:00.000Z');
  expect(network.fetch).toHaveBeenCalledWith(`/viaturas/${id}/discard`, {
    method: 'DELETE',
    headers: { 'x-expected-updated-at': '2026-11-01T00:00:00.000Z' },
  });
  expect(get(draftNotificationsRevision)).toBe(revision + 1);
  expect(network.clear).toHaveBeenCalledOnce();
});
