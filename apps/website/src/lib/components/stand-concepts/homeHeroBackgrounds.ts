import { homeV5Images } from '$lib/homeV5Images';

const wide = homeV5Images['forest-wide'];
const portrait = homeV5Images['forest-portrait'];
/** The approved fifth composition is now the permanent homepage hero. */
export const heroBackgrounds = {
  5: {
    src: wide.src,
    desktop: wide.srcset,
    portrait: portrait.srcset,
    avifDesktop: wide.avif,
    avifPortrait: portrait.avif,
    width: wide.width,
    height: wide.height,
    focus: '50% 70%',
    mobileFocus: '50% 50%',
  },
} as const;
