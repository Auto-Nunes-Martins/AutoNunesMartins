import {
  anchorTarget,
  createAnchorScroller,
  internalAnchor,
} from './components/stand-concepts/slowAnchor';
import type { AnchorScrollProfile } from './components/stand-concepts/slowAnchor';
import type { AnchorArrival } from './components/stand-concepts/slowAnchor';
import './anchorNavigation.css';

type Options = {
  tick: () => Promise<void>;
  push: (url: URL) => void;
  navigate: (url: URL) => Promise<void>;
};
export function installAnchorNavigation({ tick, push, navigate }: Options) {
  const scroller = createAnchorScroller();
  let version = 0;
  let frame = 0;
  const stop = () => {
    ++version;
    cancelAnimationFrame(frame);
    scroller.stop();
  };
  const reveal = async (
    hash: string,
    profile: AnchorScrollProfile = 'default',
    arrival?: AnchorArrival,
  ) => {
    stop();
    const request = version;
    // Link handlers close mobile menus first; measure after their DOM update.
    await tick();
    if (request !== version) return;
    frame = requestAnimationFrame(() => {
      if (request !== version) return;
      const target = anchorTarget(hash);
      if (target) scroller.scroll(target, profile, arrival);
    });
  };
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link) return;
    const current = new URL(location.href);
    const url = internalAnchor(event, link, current);
    if (!url) return;
    const samePage = url.pathname === current.pathname && url.search === current.search;
    if (!samePage) {
      event.preventDefault();
      stop();
      // A newer router navigation may cancel this one; never redirect back to its stale URL.
      void navigate(url).catch(() => {});
      return;
    }
    if (samePage && !anchorTarget(url.hash)) {
      stop();
      return;
    }
    event.preventDefault();
    stop();
    if (url.hash !== current.hash) push(url);
    const discovery = current.pathname === '/' && url.hash === '#selecao';
    const profile =
      discovery && link.matches('.cabin-link')
        ? 'discovery-return'
        : discovery && link.matches('.hd-scroll')
          ? 'discovery'
          : 'default';
    void reveal(
      url.hash,
      profile,
      profile === 'default'
        ? undefined
        : {
            keyboard: event.detail === 0,
            offset: profile === 'discovery' && window.innerWidth <= 700 ? 5 : 0,
          },
    );
  };
  const events = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'popstate'] as const;
  document.addEventListener('click', click, true);
  events.forEach((event) => window.addEventListener(event, stop, { passive: true }));
  return {
    stop,
    afterNavigate(type: string, url: URL) {
      if (!['link', 'goto'].includes(type) || !url.hash) return;
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      void reveal(url.hash);
    },
    destroy() {
      stop();
      scroller.destroy();
      document.removeEventListener('click', click, true);
      events.forEach((event) => window.removeEventListener(event, stop));
    },
  };
}
