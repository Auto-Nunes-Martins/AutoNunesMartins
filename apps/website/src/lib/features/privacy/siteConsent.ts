export const CONSENT_KEY = 'anm-site-consent-v1';
const CHANGE_EVENT = 'anm-site-consent-change';
const OPEN_EVENT = 'anm-site-consent-open';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export type ConsentOptions = { preferences: boolean; maps: boolean; ads: boolean };
type Choice = ConsentOptions & { expires: number; withdrawn?: boolean };
export const essentialOnly: ConsentOptions = { preferences: false, maps: false, ads: false };
let sessionChoice: Choice | null = null;

export function readSiteConsent(): (Choice & { hasAdsDecision: boolean }) | null {
  let value = sessionChoice;
  if (!value) {
    try {
      value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
    } catch {
      return null;
    }
  }
  return value &&
    typeof value.preferences === 'boolean' &&
    typeof value.maps === 'boolean' &&
    Number.isFinite(value.expires) &&
    value.expires > Date.now()
    ? { ...value, ads: value.ads === true, hasAdsDecision: typeof value.ads === 'boolean' }
    : null;
}

export function saveSiteConsent(options: ConsentOptions | 'withdrawn') {
  const choice = {
    ...(options === 'withdrawn' ? { ...essentialOnly, withdrawn: true } : options),
    expires: Date.now() + MAX_AGE,
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
    sessionChoice = null;
  } catch {
    sessionChoice = choice;
    if (!choice.ads) {
      try {
        localStorage.removeItem(CONSENT_KEY);
      } catch {
        /* Storage unavailable. */
      }
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function watchSiteConsent(onChange: (choice: ReturnType<typeof readSiteConsent>) => void) {
  const sync = () => {
    const choice = readSiteConsent();
    if (!choice?.preferences) {
      try {
        sessionStorage.removeItem('anm-reload-position');
        sessionStorage.removeItem('orbit-reload-position');
      } catch {
        /* Storage unavailable. */
      }
    }
    onChange(choice);
  };
  const storage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY || event.key === null) {
      sessionChoice = null;
      sync();
    }
  };
  window.addEventListener(CHANGE_EVENT, sync);
  window.addEventListener('storage', storage);
  window.addEventListener('pageshow', sync);
  sync();
  return () => {
    window.removeEventListener(CHANGE_EVENT, sync);
    window.removeEventListener('storage', storage);
    window.removeEventListener('pageshow', sync);
  };
}

export function openSiteConsent(opener: HTMLElement) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: opener }));
}

export function watchConsentOpening(open: (opener: HTMLElement) => void) {
  const handle = (event: Event) => open((event as CustomEvent<HTMLElement>).detail);
  window.addEventListener(OPEN_EVENT, handle);
  return () => window.removeEventListener(OPEN_EVENT, handle);
}
