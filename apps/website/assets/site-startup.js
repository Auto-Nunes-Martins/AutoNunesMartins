// Parser-blocking, public-only startup: preserve reload position before first paint.
// Keep scene formulas aligned with scrollTiming.ts; no auth or private API access.

// app.html sets the document palette before this bundled script is inlined.
// CSS uses that document state, independently of the SSR component's class.

// Match anchorStart's resting alignment before the first paint, not at hydration.
function alignSiteFeaturedContent(hero) {
  if (innerWidth <= 700 || hero.getAttribute('data-featured-presence') !== 'expanded') return;
  var feature = hero.querySelector('.hd-feature');
  var line = hero.querySelector('.hd-progress button > span');
  var hint = hero.querySelector('.hd-scroll');
  if (!feature || !line || !hint) return;
  var style = getComputedStyle(feature);
  var scale = style.scale.split(' ').map(Number);
  var scaleY = scale[1] || scale[0] || 1;
  var lineBounds = line.getBoundingClientRect();
  var hintBounds = hint.getBoundingClientRect();
  var entryY = parseFloat(style.translate.split(' ')[1] || '0') || 0;
  var hintY = new DOMMatrixReadOnly(getComputedStyle(hint).transform).m42;
  var current = parseFloat(style.getPropertyValue('--featured-content-drop')) || 16;
  var delta =
    hintBounds.top +
    hintBounds.height / 2 -
    hintY -
    (lineBounds.top + lineBounds.height / 2 - entryY);
  var value = Math.max(0, Math.round(current + delta / scaleY)) + 'px';
  hero.style.setProperty('--featured-content-drop', value);
}

// A streamed response can paint the complete hero before the end-of-body script.
// Observe only its initial assembly and publish its natural size before rendering;
// the normal document/component initialization takes over once parsing finishes.
(function () {
  if (typeof IntersectionObserver === 'function') {
    document.documentElement.setAttribute('data-site-stats-motion', '');
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
    return !!getComputedStyle(hero).getPropertyValue('--hero-frame-height-saved');
  }
  function measure(entry) {
    if (!feature || !stylesReady()) return;
    var box = entry && entry.borderBoxSize && entry.borderBoxSize[0];
    var height = box ? Math.round(box.blockSize) : feature.offsetHeight;
    var value = height + 'px';
    if (height > 0 && hero.style.getPropertyValue('--hero-feature-height') !== value) {
      hero.style.setProperty('--hero-feature-height', value);
    }
    alignSiteFeaturedContent(hero);
  }
  function connect() {
    var marker = document.querySelector('[data-hero-layout-ready]');
    if (!marker) return;
    hero = marker.closest('.hd-root');
    feature = marker.closest('.hd-feature');
    if (!hero || !hero.querySelector('.hd-scroll')) return;
    assembly.disconnect();
    if (!hero || !feature) return;
    resize = new ResizeObserver(function (entries) {
      measure(entries[0]);
    });
    resize.observe(feature);
  }
  function finish() {
    assembly.disconnect();
    if (resize) resize.disconnect();
  }
  assembly.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', finish, { once: true });
})();

function allowsSiteScrollStorage() {
  try {
    var choice = JSON.parse(localStorage.getItem('anm-site-consent-v1') || 'null');
    return choice?.preferences === true && typeof choice.maps === 'boolean' &&
      Number.isFinite(choice.expires) && choice.expires > Date.now();
  } catch (_) {
    return false;
  }
}

// Restoring a document is not a user-requested smooth scroll.
if (
  location.pathname === '/' ||
  /^\/(viaturas|quem-somos|politica-de-privacidade|demo)(\/|$)/.test(location.pathname)
) {
  document.documentElement.setAttribute('data-site-restoring', '');
  const cancelRestore = function () {
    document.documentElement.removeAttribute('data-site-restore-y');
    document.documentElement.removeAttribute('data-site-restore-x');
    document.documentElement.style.removeProperty('--site-restore-height');
  };
  for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(event, cancelRestore, { passive: true, once: true });
  }
  addEventListener('pagehide', function () {
    if (!allowsSiteScrollStorage()) return;
    try {
      sessionStorage.setItem(
        'anm-reload-position',
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
    document.documentElement.removeAttribute('data-site-restoring');
    cancelRestore();
  }, 5000);
}

// Native lazy loading can start several large stock photos while the hero is loading.
// Keep the real img URLs in SSR. Only offscreen mobile-home pictures wait, and any
// scroll/resize, nearby intersection, hero completion or hero failure releases them.
window.initializeHomePhotoPriority = function (scope) {
  (scope || document)
    .querySelectorAll('source[data-home-photo-priority]')
    .forEach(function (source) {
      if (source.dataset.priorityWatching || source.media === 'not all') return;
      source.dataset.priorityWatching = 'true';
      var picture = source.parentElement;
      var observer;
      var release = function () {
        source.media = 'not all';
        if (observer) observer.disconnect();
        delete source._releaseHomePhoto;
      };
      if (!matchMedia('(max-width: 700px)').matches || typeof IntersectionObserver === 'undefined') {
        release();
        return;
      }
      // Give each card a viewport's head start, including after a fast scroll
      // or history restoration, without releasing the whole selection at once.
      observer = new IntersectionObserver(
        function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) release();
        },
        { rootMargin: Math.max(600, innerHeight) + 'px 0px' },
      );
      observer.observe(picture.parentElement);
      source._releaseHomePhoto = function () { observer.disconnect(); };
    });
};

window.initializeSiteDocument = function () {
  // The full SSR layout exists here; streamed heroes may already have painted.
  // The featured card's approved scale also reduces its occupied layout height.
  // Seed the same untransformed measurement as anchorStart before scroll/nav
  // restoration; waiting for hydration would visibly shorten the whole hero.
  document.querySelectorAll('.hd-root[data-featured-card]').forEach(function (hero) {
    var feature = hero.querySelector('.hd-feature');
    if (feature) hero.style.setProperty('--hero-feature-height', feature.offsetHeight + 'px');
    alignSiteFeaturedContent(hero);
  });
  document.querySelectorAll('.design.site').forEach(function (root) {
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
  if (document.documentElement.hasAttribute('data-site-restoring')) {
    try {
      var navigation = performance.getEntriesByType('navigation')[0];
      var saved = null;
      if (allowsSiteScrollStorage()) {
        var position = sessionStorage.getItem('anm-reload-position');
        if (position === null) {
          position = sessionStorage.getItem('orbit-reload-position');
          if (position !== null) {
            sessionStorage.setItem('anm-reload-position', position);
            sessionStorage.removeItem('orbit-reload-position');
          }
        }
        saved = JSON.parse(position || 'null');
      }
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
          '--site-restore-height',
          document.documentElement.scrollHeight + 'px',
        );
        scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
        document.documentElement.setAttribute('data-site-restore-y', String(scrollY));
        document.documentElement.setAttribute('data-site-restore-x', String(scrollX));
      }
    } catch (_) {
      /* Fall back to SvelteKit/browser scroll restoration. */
    }
    // Match the inner-page navigation before the first restored-scroll paint.
    var innerNavRoot = document.querySelector('.site-inner');
    if (innerNavRoot) {
      var contactStrip = innerNavRoot.querySelector('.nav-contact-strip');
      innerNavRoot.classList.toggle(
        'nav-compact',
        scrollY > (contactStrip ? contactStrip.offsetHeight : 0) + 2,
      );
    }
    var siteRoot = document.querySelector('.site-home, .site-company');
    var siteHero = siteRoot && siteRoot.querySelector('.home-hero, .site-intro');
    if (siteHero && siteRoot.classList.contains('site-home')) {
      // Same distance-based arrival as compactNavProgress; no first-paint flash on reload.
      var navDistance = Math.max(100, Math.min(180, innerHeight * 0.18));
      var navStart =
        scrollY < 100
          ? 100
          : Math.max(100, siteHero.getBoundingClientRect().bottom + scrollY - navDistance);
      var navProgress = Math.max(0, Math.min(1, (scrollY - navStart) / navDistance));
      var navPinned = scrollY >= navStart;
      siteRoot.classList.toggle('nav-pinned', navPinned);
      siteRoot.classList.remove('nav-hidden');
      var siteHeader = siteRoot.querySelector('.stand-header');
      if (siteHeader) siteHeader.style.setProperty('--nav-progress', String(navProgress));
      if (siteHeader && navPinned && navProgress <= 0) {
        siteHeader.inert = true;
        siteHeader.setAttribute('aria-hidden', 'true');
      }
    }
    if (siteRoot && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Pre-paint equivalents of scrollTiming.ts; hydration continues from this pose.
      // No timers, image measurements or changes to the document's layout.
      var clampProgress = function (n) {
        return Math.max(0, Math.min(1, n));
      };
      var chapterProgress = function (n, a, b) {
        return clampProgress((n - a) / (b - a));
      };
      siteRoot.classList.add('motion-on');
      // Read every scene before writing its pose: avoid layout flushes between scenes.
      var sceneWrites = [];
      var setSceneStyle = function (node, name, value) {
        sceneWrites.push([node, name, value]);
      };
      siteRoot.querySelectorAll('[data-scene]').forEach(function (scene) {
        var bounds = scene.getBoundingClientRect();
        if (bounds.bottom < -50 || bounds.top > innerHeight + 50) return;
        var pin = scene.querySelector(':scope > [data-pin]');
        var sticky = pin && getComputedStyle(pin).position === 'sticky';
        var range = sticky ? bounds.height - pin.offsetHeight : 0;
        var progress =
          range > 1
            ? clampProgress(((parseFloat(getComputedStyle(pin).top) || 0) - bounds.top) / range)
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
          setSceneStyle(
            scene,
            '--accent-stage-shift',
            bounds.top + accentTravel - heroBounds.top + 'px',
          );
          setSceneStyle(
            scene,
            '--accent-progress',
            accentRange > 1 ? clampProgress((accentPinTop - accentTop) / accentRange) : 0,
          );
          var documentTop = bounds.top + scrollY;
          var resting = clampProgress(
            (Math.max(0, (innerHeight - heroHeight) / 2) - documentTop) /
              Math.max(1, innerHeight * 0.04),
          );
          var travel = Math.max(1, Math.min(heroHeight * 0.75, innerHeight * 0.6));
          progress = resting + (1 - resting) * clampProgress((documentTop - bounds.top) / travel);
        }
        setSceneStyle(scene, '--p', progress);
        setSceneStyle(
          scene,
          '--through',
          clampProgress((innerHeight - bounds.top) / Math.max(1, innerHeight + bounds.height)),
        );
        setSceneStyle(
          scene,
          '--enter',
          clampProgress((innerHeight * 0.82 - bounds.top) / Math.max(1, innerHeight * 0.52)),
        );
        setSceneStyle(scene, '--stage-a', chapterProgress(progress, 0, 0.88));
        setSceneStyle(scene, '--stage-b', chapterProgress(progress, 0.1, 1));
        if (scene.hasAttribute('data-approach')) {
          var target = scene.querySelector('[data-approach-target]');
          var output = scene.dataset.approach === 'target' && target ? target : scene;
          var rect = target ? target.getBoundingClientRect() : bounds;
          var denominator = Math.max(1, innerHeight * 0.44 + rect.height / 2);
          var approach = clampProgress((innerHeight * 0.94 - rect.top) / denominator);
          setSceneStyle(output, '--approach', approach);
          setSceneStyle(
            output,
            '--scan',
            clampProgress(
              (innerHeight * 0.94 -
                rect.top -
                innerHeight * (Number(scene.dataset.scanDelay) || 0)) /
                denominator,
            ),
          );
          setSceneStyle(output, '--reveal-a', chapterProgress(approach, 0.06, 0.58));
          setSceneStyle(output, '--reveal-b', chapterProgress(approach, 0.28, 0.83));
          setSceneStyle(output, '--reveal-c', chapterProgress(approach, 0.5, 1));
        }
      });
      setSceneStyle(
        siteRoot,
        '--reading',
        clampProgress(scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)),
      );
      sceneWrites.forEach(function (write) {
        write[0].style.setProperty(write[1], write[2]);
      });
    }
  }
  window.initializeHomePhotoPriority();
};
