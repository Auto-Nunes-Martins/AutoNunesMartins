import { CONSENT_KEY, watchSiteConsent } from './siteConsent';

const CONTAINER_URL = 'https://www.googletagmanager.com/gtm.js?id=GTM-W83CLHNR';
const ANALYTICS_ID = 'G-8R2S370Q2Z';
const ANALYTICS_DISABLED = `ga-disable-${ANALYTICS_ID}` as const;

export function watchGoogleMeasurementConsent() {
  const page = window as Window & { dataLayer?: unknown[]; [ANALYTICS_DISABLED]?: boolean };
  let container: HTMLScriptElement | undefined;
  let analyticsTag: HTMLScriptElement | undefined;
  let advertisingAllowed = false;
  let analyticsAllowed = false;

  const gtag: (...args: unknown[]) => void = function () {
    (page.dataLayer ??= []).push(arguments);
  };
  function setGoogleConsent(action: 'default' | 'update') {
    gtag('consent', action, {
      analytics_storage: analyticsAllowed ? 'granted' : 'denied',
      ad_storage: advertisingAllowed ? 'granted' : 'denied',
      ad_user_data: advertisingAllowed ? 'granted' : 'denied',
      ad_personalization: 'denied',
    });
  }

  function loadScript(src: string) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.append(script);
    return script;
  }

  page[ANALYTICS_DISABLED] = true;
  setGoogleConsent('default');
  return watchSiteConsent((choice) => {
    const ads = choice?.ads === true;
    const analytics = choice?.analytics === true;
    if (ads === advertisingAllowed && analytics === analyticsAllowed) return;
    const adsRevoked = advertisingAllowed && !ads;
    const analyticsRevoked = analyticsAllowed && !analytics;
    advertisingAllowed = ads;
    analyticsAllowed = analytics;
    page[ANALYTICS_DISABLED] = !analytics;
    setGoogleConsent('update');

    if (adsRevoked || analyticsRevoked) {
      // A reload stops the code already executed in this document. If storage
      // is read-only and still records a grant, keep the denial in memory.
      try {
        const persisted = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
        if (
          persisted?.expires > Date.now() &&
          ((adsRevoked && persisted.ads === true) ||
            (analyticsRevoked && persisted.analytics === true))
        )
          return;
      } catch {
        /* Missing or inaccessible storage cannot restore the grant. */
      }
      window.location.reload();
      return;
    }

    if (ads && !container) {
      (page.dataLayer ??= []).push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      container = loadScript(CONTAINER_URL);
    }
    if (analytics && !analyticsTag) {
      gtag('js', new Date());
      gtag('config', ANALYTICS_ID, {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
      analyticsTag = loadScript(`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_ID}`);
    }
  });
}
