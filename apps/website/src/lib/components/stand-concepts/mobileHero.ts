// Conservative windows keep height-driven cover at every stage of the approved zoom.
// Reduced motion, empty highlights and larger screens retain the complete portrait.
export const narrowHeroMedia = '(max-width: 430px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)';
export const compactHeroMedia = '(min-width: 431px) and (max-width: 540px) and (prefers-reduced-motion: no-preference), (max-width: 430px) and (max-height: 699px) and (prefers-reduced-motion: no-preference)';
export const fullHeroMedia = '(min-width: 541px) and (max-width: 700px), (max-width: 700px) and (prefers-reduced-motion: reduce)';
export const portraitHeroSizes = 'max(calc(55vw + 600px), 105.5vw, 94.95vh)';
// Same source-pixel density as the complete portrait, scaled by the retained fraction.
export const narrowHeroSizes = 'max(calc(34.375vw + 375px), 65.9375vw, 59.34375vh)';
export const compactHeroSizes = 'max(calc(41.25vw + 450px), 79.125vw, 71.2125vh)';
