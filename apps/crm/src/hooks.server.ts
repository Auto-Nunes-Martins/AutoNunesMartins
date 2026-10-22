import { withClerkHandler } from 'svelte-clerk/server';
import { sequence } from '@sveltejs/kit/hooks';
import { base } from '$app/paths';
import type { Handle } from '@sveltejs/kit';
import { beginNavigationTiming, finishNavigationTiming } from '$lib/server/navigationTiming';

const security: Handle = async ({ event, resolve }) => {
  const route = event.url.pathname.slice(base.length) || '/';
  // Layout loads do not protect +server endpoints. Guard the entire server surface.
  if (route !== '/' && !event.locals.auth().userId) {
    // Enhanced actions and JSON relays must not follow a redirect to login HTML.
    const message = 'A sessão terminou. Entre novamente para continuar.';
    if (event.request.headers.get('x-sveltekit-action') === 'true') {
      return Response.json({ type: 'error', status: 401, error: { message } }, { status: 401 });
    }
    if (!event.isDataRequest && !event.request.headers.get('accept')?.includes('text/html')) {
      return Response.json({ error: message }, { status: 401 });
    }
    return new Response(null, { status: 303, headers: { location: base + '/' } });
  }
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method) &&
    event.request.headers.get('origin') !== event.url.origin
  ) {
    return new Response('Origem inválida', { status: 403 });
  }
  return resolve(event);
};
const clerk = sequence(withClerkHandler(), security);
export const handle: Handle = async (input) => {
  beginNavigationTiming(input.event.locals);
  let resolveMs = 0;
  const response = await clerk({ ...input, resolve: async (event, options) => {
    const start = performance.now();
    try { return await input.resolve(event, options); }
    finally { resolveMs += performance.now() - start; }
  } });
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  finishNavigationTiming(input.event.locals, response, input.event.route?.id ?? null, input.event.isDataRequest, resolveMs);
  return response;
};
