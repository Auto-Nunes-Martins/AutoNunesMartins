import { withClerkHandler } from 'svelte-clerk/server';
import { sequence } from '@sveltejs/kit/hooks';
import { base } from '$app/paths';
import type { Handle } from '@sveltejs/kit';

const security: Handle = async ({ event, resolve }) => {
  const route = event.url.pathname.slice(base.length) || '/';
  // Layout loads do not protect +server endpoints. Guard the entire server surface.
  if (route !== '/' && !event.locals.auth().userId) {
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
  const response = await clerk(input);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
};
