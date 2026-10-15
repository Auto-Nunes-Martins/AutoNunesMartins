import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

// Public app only: deliberately no session provider, auth middleware or CRM credentials.
export const handle: Handle = async ({ event, resolve }) => {
  // Remove only the preference cookie from the discarded SSR experiment.
  // The active theme uses localStorage and never consumes this cookie's value.
  if (event.cookies?.get('anm-orbit-theme') !== undefined && event.cookies) {
    event.cookies.delete('anm-orbit-theme', { path: '/' });
  }
  const response = await resolve(event);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Staging indexation is explicit; the combined gateway also protects Render preview hosts.
  if (response.status >= 400) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  } else if (env.SITE_NOINDEX === 'true') {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  return response;
};
