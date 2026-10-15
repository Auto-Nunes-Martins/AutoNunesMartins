import { base } from '$app/paths';

/** Prefix only local CRM paths; never rewrite external URLs or API backend paths. */
export function crmPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Expected a local CRM path');
  return base + path;
}

export function crmRoute(path: string): string {
  return base && (path === base || path.startsWith(base + '/'))
    ? path.slice(base.length) || '/'
    : path;
}
