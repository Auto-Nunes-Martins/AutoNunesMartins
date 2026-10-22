import { enhance as kitEnhance, applyAction } from '$app/forms';
import type { SubmitFunction } from '@sveltejs/kit';
import { refreshCrmSession, sessionRejected } from './session';
import { listNavigationCache } from '$lib/lists/navigationCache';

// Validate before the caller sets its saving/disabled state. Failed renewal
// cancels the submit without clearing fields or replaying the POST.
export function enhance<Success extends Record<string, unknown> | undefined, Failure extends Record<string, unknown> | undefined>(
  form: HTMLFormElement, submit: SubmitFunction<Success, Failure> = () => {},
) {
  return kitEnhance<Success, Failure>(form, async (input) => {
    try {
      await refreshCrmSession(false);
    } catch {
      input.cancel();
      return;
    }
    const callback = await submit(input);
    return async (outcome) => {
      // Clear before callbacks/redirects can navigate back to a previously visited list.
      if (outcome.result.type === 'success' || outcome.result.type === 'redirect') listNavigationCache.clear();
      if (outcome.result.status === 401) {
        sessionRejected();
        // Keep enhanced forms mounted if the session expires during the POST.
        outcome.result = {
          type: 'failure', status: 401,
          data: { error: 'A sessão terminou. Entre novamente antes de voltar a guardar.' },
        } as unknown as typeof outcome.result;
        const failure = outcome.result;
        // SvelteKit's original update closes over its original result. Replace
        // it as well so a callback cannot apply the original error-page result.
        outcome.update = async () => { await applyAction(failure); };
      }
      if (callback) await callback(outcome);
      else await outcome.update({ reset: outcome.result.type === 'success', invalidateAll: outcome.result.type === 'success' });
    };
  });
}
