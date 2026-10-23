import { homeV5Images } from '$lib/homeV5Images';
import { homeVisitThemes, type VisitTheme } from './homeVisitThemes';

export type SceneBackground = {
  src: string;
  desktop: string;
  portrait: string;
  avifDesktop?: string;
  avifPortrait?: string;
  portraitAspectRatio?: number;
  width: number;
  height: number;
  focus: string;
  mobileFocus: string;
  theme?: VisitTheme;
  exposure?: number;
};
export type VisualFamily = {
  name: string;
  catalog: SceneBackground;
  pause: SceneBackground;
  visit: SceneBackground;
};
const scene = (
  wide: keyof typeof homeV5Images,
  portrait: keyof typeof homeV5Images,
  focus: string,
): SceneBackground => ({
  src: homeV5Images[wide].src,
  desktop: homeV5Images[wide].srcset,
  portrait: homeV5Images[portrait].srcset,
  avifDesktop: homeV5Images[wide].avif,
  avifPortrait: homeV5Images[portrait].avif,
  portraitAspectRatio: homeV5Images[portrait].width / homeV5Images[portrait].height,
  width: homeV5Images[wide].width,
  height: homeV5Images[wide].height,
  focus,
  mobileFocus: '50% 50%',
});
export const homeVisualFamilies: Record<5, VisualFamily> = {
  5: {
    name: 'Floresta densa e estrada cinzenta',
    catalog: scene('forest-wide', 'catalog-portrait', '50% 70%'),
    pause: scene('curves-wide', 'curves-portrait', '50% 48%'),
    visit: { ...scene('visit-wide', 'visit-portrait', '50% 50%'), theme: homeVisitThemes[5] },
  },
};
