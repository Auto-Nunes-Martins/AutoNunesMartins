export type FadeSide = { intensity: number; width: number; softness: number };
export type HeroFade = { symmetric: boolean; left: FadeSide; right: FadeSide; common: FadeSide };
export function originalFade(): HeroFade {
  return { symmetric: false, left: { intensity: 100, width: 62, softness: 65 }, right: { intensity: 100, width: 38, softness: 74 }, common: { intensity: 100, width: 35, softness: 65 } };
}
/** Null keeps the exact existing CSS (including its original image edge mask). */
export function lateralFade(fade: HeroFade): string | null {
  const defaults = originalFade();
  if (!fade.symmetric && JSON.stringify(fade.left) === JSON.stringify(defaults.left) && JSON.stringify(fade.right) === JSON.stringify(defaults.right)) return null;
  function side(value: FadeSide, direction: number, shoulderOpacity: number) {
    if (value.width === 0 || value.intensity === 0) return 'linear-gradient(transparent, transparent)';
    const width = Math.min(fade.symmetric ? 49 : 80, Math.max(0, value.width));
    const intensity = Math.min(100, Math.max(0, value.intensity));
    const shoulder = width * (1 - Math.min(100, Math.max(0, value.softness)) / 100);
    return `linear-gradient(${direction}deg, color-mix(in srgb, var(--bg) ${intensity}%, transparent), color-mix(in srgb, var(--bg) ${intensity * shoulderOpacity}%, transparent) ${shoulder}%, transparent ${width}%)`;
  }
  return fade.symmetric
    ? `${side(fade.common, 90, .92)}, ${side(fade.common, 270, .92)}`
    : `${side(fade.left, 90, .92)}, ${side(fade.right, 270, .55)}`;
}
