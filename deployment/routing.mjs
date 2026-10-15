/** Validate explicit canonical origins before accepting any traffic. */
export function origin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute origin`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.origin !== value
  ) {
    throw new Error(`${name} must contain only scheme and host, without a trailing slash`);
  }
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error(`${name} requires HTTPS`);
  }
  return url;
}
export function config(env) {
  const website = origin(env.WEBSITE_ORIGIN, 'WEBSITE_ORIGIN');
  const crm = origin(env.CRM_ORIGIN || env.WEBSITE_ORIGIN, 'CRM_ORIGIN');
  const base = env.CRM_BASE_PATH ?? '/crm';
  if (base !== '' && !/^\/[a-zA-Z0-9_-]+$/.test(base)) throw new Error('Invalid CRM_BASE_PATH');
  if (website.host === crm.host && !base) throw new Error('Same-host CRM requires a base path');
  const preview = website.hostname.endsWith('.onrender.com');
  if (env.SITE_NOINDEX && !['true', 'false'].includes(env.SITE_NOINDEX))
    throw new Error('Invalid SITE_NOINDEX');
  return { website, crm, base, noindex: preview || env.SITE_NOINDEX === 'true' };
}
export function selectRoute(settings, host, rawUrl) {
  if (host !== settings.website.host && host !== settings.crm.host) return null;
  // Reject ambiguous/encoded separators and dot segments before URL normalization.
  if (
    !rawUrl.startsWith('/') ||
    rawUrl.startsWith('//') ||
    /[\\\x00-\x20#]/.test(rawUrl) ||
    /%(?:2f|5c|2e|00)/i.test(rawUrl.split('?')[0]) ||
    /(?:^|\/)\.{1,2}(?:\/|\?|$)/.test(rawUrl)
  )
    return null;
  const pathname = rawUrl.split('?')[0];
  if (pathname === '/healthz') return { service: 'health', origin: settings.website.origin };
  const crmHostOnly = settings.crm.host !== settings.website.host && host === settings.crm.host;
  if (
    crmHostOnly ||
    (settings.base && (pathname === settings.base || pathname.startsWith(settings.base + '/')))
  ) {
    if (host !== settings.crm.host) return null;
    return { service: 'crm', origin: settings.crm.origin };
  }
  if (
    pathname === '/webhooks/clerk' ||
    (pathname.startsWith('/api/') && pathname !== '/api/contact')
  ) {
    return {
      service: 'backend',
      origin: host === settings.crm.host ? settings.crm.origin : settings.website.origin,
    };
  }
  if (host !== settings.website.host) return null;
  return { service: 'website', origin: settings.website.origin };
}
