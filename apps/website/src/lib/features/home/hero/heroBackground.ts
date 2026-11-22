import { homeSceneImages } from '$lib/homeSceneImages';

const wide = homeSceneImages['forest-wide'];
const portrait = homeSceneImages['forest-portrait'];
export const heroBackground = {
  src: wide.src,
  desktop: wide.srcset,
  portrait: portrait.srcset,
  avifDesktop: wide.avif,
  avifPortrait: portrait.avif,
  width: wide.width,
  height: wide.height,
} as const;
