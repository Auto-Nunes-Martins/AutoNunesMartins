import { withClerkHandler } from 'svelte-clerk/server';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { base } from '$app/paths';
import type { Handle } from '@sveltejs/kit';

const security: Handle = async ({ event, resolve }) => {
  const route = event.url.pathname.slice(base.length) || '/';
  // Layout loads do not protect +server endpoints. Guard the entire server surface.
  if (route !== '/' && !event.locals.auth().userId) {
    return new Response(null, { status: 303, headers: { location: base + '/' } });
  }
  const allowed = env.ADMIN_CLERK_USER_IDS?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const userId = event.locals.auth().userId;
  if (userId && allowed?.length && !allowed.includes(userId))
    return new Response('Sem acesso', { status: 403 });
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
