import { CONSENT_KEY, watchSiteConsent } from './siteConsent';

const CONTAINER_URL = 'https://www.googletagmanager.com/gtm.js?id=GTM-W83CLHNR';

export function watchGoogleAdsConsent() {
  const page = window as Window & { dataLayer?: unknown[] };
  let container: HTMLScriptElement | undefined;
  let advertisingAllowed = false;

  function setGoogleConsent(action: 'default' | 'update', granted: boolean) {
    const gtag: (...args: unknown[]) => void = function () {
      (page.dataLayer ??= []).push(arguments);
    };
    gtag('consent', action, {
      analytics_storage: 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: 'denied',
    });
  }

  return watchSiteConsent((choice) => {
    const allowed = choice?.ads === true;
    if (allowed === advertisingAllowed) return;
    advertisingAllowed = allowed;
    if (!allowed) {
      setGoogleConsent('update', false);
      container?.remove();
      // A reload stops the code already executed in this document. If storage
      // is read-only and still records a grant, keep the denial in memory.
      try {
        const persisted = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
        if (persisted?.ads === true && persisted.expires > Date.now()) return;
      } catch {
        /* Missing or inaccessible storage cannot restore the grant. */
      }
      window.location.reload();
      return;
    }
    setGoogleConsent('default', false);
    setGoogleConsent('update', true);
    if (container) return;
    (page.dataLayer ??= []).push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    container = document.createElement('script');
    container.async = true;
    container.src = CONTAINER_URL;
    document.head.append(container);
  });
}
