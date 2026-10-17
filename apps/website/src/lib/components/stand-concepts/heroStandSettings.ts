import { originalFade, type HeroFade } from './heroBackgroundFade';
export type StandRendering = { mode: 'reference' | 'responsive'; viewport: number; imageWidth: number; imageHeight: number; left: number; top: number };
export type StandProfile = { width: number; height: number; zoom: number; x: number | null; y: number | null; cropLeft: number; cropRight: number; symmetricCrop: boolean; cropPossible: boolean; fade: HeroFade; rendering?: StandRendering };
export type StandIndex = 0 | 1;
export const standNames = ['Stand original', 'Segundo stand'] as const;
export function validStandIndex(index: number): StandIndex { return index === 1 ? 1 : 0; }
export type StandSettings = { profiles: [StandProfile, StandProfile]; selected: StandIndex; playing: boolean; interval: number; revision: number };
export function standDefaults(): StandSettings {
  const firstFade = originalFade();
  firstFade.symmetric = true;
  firstFade.common = { intensity: 100, width: 28, softness: 100 };
  const secondFade = originalFade();
  secondFade.symmetric = true;
  secondFade.common = { intensity: 100, width: 28, softness: 100 };
  return {
    profiles: [
      { width: 104, height: 100, zoom: 65, x: 50, y: 72, cropLeft: 0, cropRight: 0, symmetricCrop: true, cropPossible: true, fade: firstFade },
      { width: 102, height: 100, zoom: 84, x: 100, y: 63, cropLeft: 0, cropRight: 0, symmetricCrop: true, cropPossible: true, fade: secondFade }
    ],
    selected: 0, playing: true, interval: 10, revision: 0
  };
}
