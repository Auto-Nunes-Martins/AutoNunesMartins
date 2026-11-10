interface Cookiebot {
  hasResponse: boolean;
  consent: {
    method: 'explicit' | 'implied' | null;
    preferences: boolean;
    statistics: boolean;
    marketing: boolean;
  };
  renew: () => void;
  withdraw: () => void;
}

declare global {
  interface Window {
    Cookiebot?: Cookiebot;
  }
}

export function watchMapConsent(update: (allowed: boolean) => void) {
  const sync = () => {
    const cmp = window.Cookiebot;
    update(
      cmp?.hasResponse === true &&
        cmp.consent?.method === 'explicit' &&
        cmp.consent.marketing === true,
    );
  };
  const events = [
    'CookiebotOnConsentReady',
    'CookiebotOnAccept',
    'CookiebotOnDecline',
    'CookiebotOnDialogDisplay',
    'pageshow',
  ];
  for (const event of events) window.addEventListener(event, sync);
  sync();
  return () => {
    for (const event of events) window.removeEventListener(event, sync);
  };
}
