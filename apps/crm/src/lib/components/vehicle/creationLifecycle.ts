import { writable } from 'svelte/store';
import { sessionFetch } from '$lib/auth/session';
import { crmPath } from '$lib/paths';
import { listNavigationCache } from '$lib/lists/navigationCache';

export const draftNotificationsRevision = writable(0);
export function draftsChanged() {
  listNavigationCache.clear();
  draftNotificationsRevision.update((value) => value + 1);
}
const key = (owner: string | null, id: string) => `anm:new-creation:${owner}:${id}`;
const createdInThisDocument = new Set<string>();
/** Written only after the server's successful create response, never from a route parameter. */
export function rememberCreatedDraft(owner: string | null, location?: string) {
  if (!owner || !location) return;
  const url = new URL(location, window.location.origin);
  const id = url.searchParams.get('viatura');
  if (url.origin !== window.location.origin || url.pathname !== crmPath('/viaturas/nova') || !id)
    return;
  createdInThisDocument.add(key(owner, id));
  try {
    sessionStorage.setItem(key(owner, id), '1');
  } catch {
    /* Refresh conservatively resumes an existing draft. */
  }
}
export function isNewCreation(owner: string | null, id: string) {
  if (!owner) return false;
  const identity = key(owner, id);
  if (createdInThisDocument.has(identity)) return true;
  // New tabs can inherit a copy of sessionStorage from their opener. Only an
  // actual reload may recover provenance without this document's create response.
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (navigation?.type !== 'reload') {
    forgetCreation(owner, id);
    return false;
  }
  try {
    return sessionStorage.getItem(identity) === '1';
  } catch {
    return false;
  }
}
export function forgetCreation(owner: string | null, id: string) {
  createdInThisDocument.delete(key(owner, id));
  try {
    sessionStorage.removeItem(key(owner, id));
  } catch {
    /* No destructive fallback. */
  }
}
export async function discardVehicleDraft(id: string, expectedUpdatedAt?: string) {
  const response = await sessionFetch(crmPath(`/viaturas/${encodeURIComponent(id)}/discard`), {
    method: 'DELETE',
    ...(expectedUpdatedAt ? { headers: { 'x-expected-updated-at': expectedUpdatedAt } } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Error(
      response.status === 403
        ? 'Sem permissão para eliminar este rascunho. Os dados foram preservados.'
        : (result.error ??
            'Não foi possível eliminar o rascunho. Os dados foram mantidos; tente novamente.'),
    );
  draftsChanged();
}
