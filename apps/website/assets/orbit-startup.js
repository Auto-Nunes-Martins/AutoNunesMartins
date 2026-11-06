// Parser-blocking, public-only startup: preserve reload position before first paint.
// Keep scene formulas aligned with scrollTiming.ts; no auth or private API access.

// app.html sets the document palette before this bundled script is inlined.
// CSS uses that document state, independently of the SSR component's class.

// A streamed response can paint the complete hero before the end-of-body script.
// Observe only its initial assembly and publish its natural size before rendering;
// the normal document/component initialization takes over once parsing finishes.
(function () {
  if (typeof IntersectionObserver === 'function') {
    document.documentElement.setAttribute('data-orbit-stats-motion', '');
  }
  if (
    location.pathname !== '/' ||
    typeof MutationObserver !== 'function' ||
    typeof ResizeObserver !== 'function'
  )
    return;
  var hero;
  var feature;
  var resize;
  var assembly = new MutationObserver(connect);
  function stylesReady() {
    var sheets = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      if (!sheet.disabled && (!sheet.media || matchMedia(sheet.media).matches) && !sheet.sheet)
        return false;
    }
    return !!getComputedStyle(hero).getPropertyValue('--v5-frame-height-saved');
  }
  function measure(entry) {
    if (!feature || !stylesReady()) return;
    var box = entry && entry.borderBoxSize && entry.borderBoxSize[0];
    var height = box ? Math.round(box.blockSize) : feature.offsetHeight;
    var value = height + 'px';
    if (height > 0 && hero.style.getPropertyValue('--v5-feature-height') !== value) {
      hero.style.setProperty('--v5-feature-height', value);
    }
  }
  function connect() {
    var marker = document.querySelector('[data-hero-layout-ready]');
    if (!marker) return;
    hero = marker.closest('.hd-root');
    feature = marker.closest('.hd-feature');
    assembly.disconnect();
    if (!hero || !feature) return;
    resize = new ResizeObserver(function (entries) {
      measure(entries[0]);
    });
    resize.observe(feature);
    measure();
  }
  function stylesheetLoaded(event) {
    if (event.target.tagName === 'LINK' || event.target.tagName === 'STYLE') measure();
  }
  function finish() {
    assembly.disconnect();
    if (resize) resize.disconnect();
    document.removeEventListener('load', stylesheetLoaded, true);
  }
  assembly.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('load', stylesheetLoaded, true);
  document.addEventListener('DOMContentLoaded', finish, { once: true });
})();

function allowsOrbitScrollStorage() {
  var cmp = window.Cookiebot;
  return cmp?.hasResponse === true &&
    cmp.consent?.method === 'explicit' && cmp.consent.preferences === true;
}

// Restoring a document is not a user-requested smooth scroll.
if (
  location.pathname === '/' ||
  /^\/(viaturas|quem-somos|politica-de-privacidade|demo)(\/|$)/.test(location.pathname)
) {
  document.documentElement.setAttribute('data-orbit-restoring', '');
  const cancelRestore = function () {
    document.documentElement.removeAttribute('data-orbit-restore-y');
    document.documentElement.removeAttribute('data-orbit-restore-x');
    document.documentElement.style.removeProperty('--orbit-restore-height');
  };
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(event, cancelRestore, { passive: true, once: true });
  }
  addEventListener('pagehide', function () {
    if (!allowsOrbitScrollStorage()) return;
    try {
      sessionStorage.setItem(
        'orbit-reload-position',
        JSON.stringify({
          url: location.href,
          x: scrollX,
          y: scrollY,
          time: Date.now(),
        }),
      );
    } catch (_) {
      /* Storage is optional; native restoration remains available. */
    }
  });
  // Fail open if JavaScript hydration is unavailable.
  setTimeout(function () {
    document.documentElement.removeAttribute('data-orbit-restoring');
    cancelRestore();
  }, 5000);
}

// Native lazy loading can start several large stock photos while the hero is loading.
// Keep the real img URLs in SSR. Only offscreen mobile-home pictures wait, and any
// scroll/resize, nearby intersection, hero completion or hero failure releases them.
window.initializeHomePhotoPriority = function (scope) {
  (scope || document).querySelectorAll('source[data-home-photo-priority]').forEach(function (source) {
    if (source.dataset.priorityWatching || source.media === 'not all') return;
    source.dataset.priorityWatching = 'true';
    var picture = source.parentElement;
    var hero = document.querySelector('.hd-landscape img');
    var observer;
    var initialWidth = innerWidth;
    var initialHeight = innerHeight;
    var initialScroll = scrollY;
    var viewportChanged = function () {
      // Chrome can emit initial resize/scroll events without a viewport change.
      if (scrollY !== initialScroll || innerWidth !== initialWidth || innerHeight !== initialHeight) release();
    };
    var release = function () {
      source.media = 'not all';
      if (observer) observer.disconnect();
      if (hero) {
        hero.removeEventListener('load', release);
        hero.removeEventListener('error', release);
      }
      removeEventListener('scroll', viewportChanged);
      removeEventListener('resize', viewportChanged);
      delete source._releaseHomePhoto;
    };
    source._releaseHomePhoto = release;
    if (!matchMedia('(max-width: 700px)').matches || scrollY > 0 || !hero || hero.complete ||
        picture.parentElement.getBoundingClientRect().top < innerHeight + 400 ||
        typeof IntersectionObserver === 'undefined') {
      release();
      return;
    }
    observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) release();
    }, { rootMargin: '400px' });
    observer.observe(picture.parentElement);
    hero.addEventListener('load', release, { once: true });
    hero.addEventListener('error', release, { once: true });
    addEventListener('scroll', viewportChanged, { passive: true });
    addEventListener('resize', viewportChanged, { passive: true });
  });
};

window.initializeOrbitDocument = function () {
  // The full SSR layout exists here; streamed heroes may already have painted.
  // The featured card's approved scale also reduces its occupied layout height.
  // Seed the same untransformed measurement as anchorStart before scroll/nav
  // restoration; waiting for hydration would visibly shorten the whole hero.
  document.querySelectorAll('.hd-root[data-featured-card]').forEach(function (hero) {
    var feature = hero.querySelector('.hd-feature');
    if (feature) hero.style.setProperty('--v5-feature-height', feature.offsetHeight + 'px');
  });
  document.querySelectorAll('.design.orbit').forEach(function (root) {
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    root.classList.toggle('dark', dark);
    root.querySelectorAll('[data-theme-logo]').forEach(function (logo) {
      var source = logo.getAttribute(dark ? 'data-logo-dark' : 'data-logo-light');
      var sourceSet = logo.getAttribute(dark ? 'data-logo-dark-srcset' : 'data-logo-light-srcset');
      if (sourceSet) logo.setAttribute('srcset', sourceSet);
      if (source) logo.setAttribute('src', source);
    });
    root.querySelectorAll('[data-theme-command]').forEach(function (button) {
      var label = dark ? 'Mudar para tema claro' : 'Mudar para tema escuro';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
  });
  if (document.documentElement.hasAttribute('data-orbit-restoring')) {
    try {
      var navigation = performance.getEntriesByType('navigation')[0];
      var saved = allowsOrbitScrollStorage()
        ? JSON.parse(sessionStorage.getItem('orbit-reload-position') || 'null')
        : null;
      if (
        navigation &&
        navigation.type === 'reload' &&
        saved &&
        saved.url === location.href &&
        Date.now() - saved.time < 60000 &&
        Number.isFinite(saved.y) &&
        Number.isFinite(saved.x)
      ) {
        // Keep the SSR scroll range while hydration briefly replaces font styles.
        // The guard expires after initialization and never constrains normal scrolling.
        document.documentElement.style.setProperty(
          '--orbit-restore-height',
          document.documentElement.scrollHeight + 'px',
        );
        scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
        document.documentElement.setAttribute('data-orbit-restore-y', String(scrollY));
        document.documentElement.setAttribute('data-orbit-restore-x', String(scrollX));
      }
    } catch (_) {
      /* Fall back to SvelteKit/browser scroll restoration. */
    }
    // Match the inner-page navigation before the first restored-scroll paint.
    var innerNavRoot = document.querySelector('.orbit-inner');
    if (innerNavRoot) {
      var contactStrip = innerNavRoot.querySelector('.nav-contact-strip');
      innerNavRoot.classList.toggle(
        'nav-compact',
        scrollY > (contactStrip ? contactStrip.offsetHeight : 0) + 2,
      );
    }
    var orbitRoot = document.querySelector('.orbit-home, .orbit-company');
    var orbitHero = orbitRoot && orbitRoot.querySelector('.hero-v1, .orbit-intro');
    if (orbitHero && orbitRoot.classList.contains('orbit-home')) {
      // Same distance-based arrival as compactNavProgress; no first-paint flash on reload.
      var navDistance = Math.max(100, Math.min(180, innerHeight * 0.18));
      var navStart = scrollY < 100 ? 100 : Math.max(
        100,
        orbitHero.getBoundingClientRect().bottom + scrollY - navDistance,
      );
      var navProgress = Math.max(0, Math.min(1, (scrollY - navStart) / navDistance));
      var navPinned = scrollY >= navStart;
      orbitRoot.classList.toggle('nav-pinned', navPinned);
      orbitRoot.classList.remove('nav-hidden');
      orbitRoot.style.setProperty('--nav-progress', String(navProgress));
      var orbitHeader = orbitRoot.querySelector('.stand-header');
      if (orbitHeader && navPinned && navProgress <= 0) {
        orbitHeader.inert = true;
        orbitHeader.setAttribute('aria-hidden', 'true');
      }
    }
    if (orbitRoot && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Pre-paint equivalents of scrollTiming.ts; hydration continues from this pose.
      // No timers, image measurements or changes to the document's layout.
      var clampOrbit = function (n) {
        return Math.max(0, Math.min(1, n));
      };
      var chapterOrbit = function (n, a, b) {
        return clampOrbit((n - a) / (b - a));
      };
      orbitRoot.classList.add('motion-on');
      // Read every scene before writing its pose: avoid layout flushes between scenes.
      var sceneWrites = [];
      var setSceneStyle = function (node, name, value) {
        sceneWrites.push([node, name, value]);
      };
      orbitRoot.querySelectorAll('[data-scene]').forEach(function (scene) {
        var bounds = scene.getBoundingClientRect();
        if (bounds.bottom < -50 || bounds.top > innerHeight + 50) return;
        var pin = scene.querySelector(':scope > [data-pin]');
        var sticky = pin && getComputedStyle(pin).position === 'sticky';
        var range = sticky ? bounds.height - pin.offsetHeight : 0;
        var progress =
          range > 1
            ? clampOrbit(((parseFloat(getComputedStyle(pin).top) || 0) - bounds.top) / range)
            : 0;
        var heroStage = scene.hasAttribute('data-scroll-hero')
          ? scene.querySelector(':scope > [data-hero-stage]')
          : null;
        if (heroStage) {
          // Equivalent to heroScrollProgress: natural scrolling, no sticky range.
          var heroBounds = heroStage.getBoundingClientRect();
          var heroHeight = heroBounds.height;
          // Stable wide-hero track; preserve the existing tablet/mobile frame.
          var accentRange = Math.max(0, bounds.height - heroHeight);
          var accentPinTop = Math.max(0, (innerHeight - heroHeight) / 2);
          var accentTop = bounds.top + (innerWidth > 1050 ? scrollY : 0);
          var accentTravel = Math.min(accentRange, Math.max(0, accentPinTop - accentTop));
          setSceneStyle(scene,
            '--accent-stage-shift',
            bounds.top + accentTravel - heroBounds.top + 'px',
          );
          setSceneStyle(scene,
            '--accent-progress',
            accentRange > 1 ? clampOrbit((accentPinTop - accentTop) / accentRange) : 0,
          );
          var documentTop = bounds.top + scrollY;
          var resting = clampOrbit(
            (Math.max(0, (innerHeight - heroHeight) / 2) - documentTop) /
              Math.max(1, innerHeight * 0.04),
          );
          var travel = Math.max(1, Math.min(heroHeight * 0.75, innerHeight * 0.6));
          progress = resting + (1 - resting) * clampOrbit((documentTop - bounds.top) / travel);
        }
        setSceneStyle(scene, '--p', progress);
        setSceneStyle(scene,
          '--through',
          clampOrbit((innerHeight - bounds.top) / Math.max(1, innerHeight + bounds.height)),
        );
        setSceneStyle(scene,
          '--enter',
          clampOrbit((innerHeight * 0.82 - bounds.top) / Math.max(1, innerHeight * 0.52)),
        );
        setSceneStyle(scene, '--stage-a', chapterOrbit(progress, 0, 0.88));
        setSceneStyle(scene, '--stage-b', chapterOrbit(progress, 0.1, 1));
        if (scene.hasAttribute('data-approach')) {
          var target = scene.querySelector('[data-approach-target]');
          var rect = target ? target.getBoundingClientRect() : bounds;
          var denominator = Math.max(1, innerHeight * 0.44 + rect.height / 2);
          var approach = clampOrbit((innerHeight * 0.94 - rect.top) / denominator);
          setSceneStyle(scene, '--approach', approach);
          setSceneStyle(scene,
            '--scan',
            clampOrbit(
              (innerHeight * 0.94 -
                rect.top -
                innerHeight * (Number(scene.dataset.scanDelay) || 0)) /
                denominator,
            ),
          );
          setSceneStyle(scene, '--reveal-a', chapterOrbit(approach, 0.06, 0.58));
          setSceneStyle(scene, '--reveal-b', chapterOrbit(approach, 0.28, 0.83));
          setSceneStyle(scene, '--reveal-c', chapterOrbit(approach, 0.5, 1));
        }
      });
      setSceneStyle(orbitRoot,
        '--reading',
        clampOrbit(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)),
      );
      sceneWrites.forEach(function (write) { write[0].style.setProperty(write[1], write[2]); });
    }
  }
  window.initializeHomePhotoPriority();
};
