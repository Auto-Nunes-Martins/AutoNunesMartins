import { homeSceneImages } from '$lib/homeSceneImages';
import { visitTheme, type VisitTheme } from './visitTheme';

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
const scene = (
  wide: keyof typeof homeSceneImages,
  portrait: keyof typeof homeSceneImages,
  focus: string,
): SceneBackground => ({
  src: homeSceneImages[wide].src,
  desktop: homeSceneImages[wide].srcset,
  portrait: homeSceneImages[portrait].srcset,
  avifDesktop: homeSceneImages[wide].avif,
  avifPortrait: homeSceneImages[portrait].avif,
  portraitAspectRatio: homeSceneImages[portrait].width / homeSceneImages[portrait].height,
  width: homeSceneImages[wide].width,
  height: homeSceneImages[wide].height,
  focus,
  mobileFocus: '50% 50%',
});
export const homeScenes = {
  catalog: scene('forest-wide', 'catalog-portrait', '50% 70%'),
  pause: scene('curves-wide', 'curves-portrait', '50% 48%'),
  visit: { ...scene('visit-wide', 'visit-portrait', '50% 50%'), theme: visitTheme },
} satisfies Record<'catalog' | 'pause' | 'visit', SceneBackground>;
