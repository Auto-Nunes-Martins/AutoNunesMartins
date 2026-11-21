import type { PhotoFraming } from '@anm/types';

export const featuredFramingRatio = { desktop: 1.65, mobile: 1.85 } as const;
export const featuredFramingPosition = (framing: PhotoFraming | undefined, device: 'desktop' | 'mobile') =>
  framing?.[device] ?? { x: 50, y: 53 };

export type HighlightItem = { vehicleId: string; photoPath: string; framing?: PhotoFraming };
export type HighlightCandidate = {
  id: string;
  brand: string;
  model: string;
  year: number;
  photoPaths: string[];
  coverFraming?: PhotoFraming;
};
export type HighlightsEditor = {
  revision: string | null;
  items: HighlightItem[];
  candidates: HighlightCandidate[];
};
