// Conservative windows keep height-driven cover at every stage of the approved zoom.
// Reduced motion, empty highlights and larger screens retain the complete portrait.
export const narrowHeroMedia =
  '(max-width: 430px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';
export const compactHeroMedia =
  '(min-width: 431px) and (max-width: 540px) and (prefers-reduced-motion: no-preference), (max-width: 430px) and (max-height: 699px) and (prefers-reduced-motion: no-preference)';
export const fullHeroMedia =
  '(min-width: 541px) and (max-width: 700px), (max-width: 700px) and (prefers-reduced-motion: reduce)';
export const portraitHeroSizes = 'max(calc(55vw + 600px), 105.5vw, 94.95vh)';
// Size the retained crop against the current compact hero, including the 1.055
// entry zoom. The old full-portrait estimate over-requested pixels after the
// mobile layout became shorter. Floors protect short screens and wrapped copy;
// the viewport-height terms still cover unusually tall screens. DPR is native.
export const narrowHeroSizes = 'max(105.5vw, 52.75vh, 420px)';
export const compactHeroSizes = 'max(105.5vw, 63.3vh, 480px)';
