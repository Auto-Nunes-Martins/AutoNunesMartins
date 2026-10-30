import type { PhotoFraming } from '@anm/types';
export type HighlightItem = { vehicleId: string; photoPath: string; framing?: PhotoFraming };
export type HighlightCandidate = {
  id: string;
  brand: string;
  model: string;
  year: number;
  slug: string;
  photos: { path: string; url: string | null; width?:number; variants?:{width:number;url:string}[] }[];
};
export type HighlightsEditor = {
  revision: string | null;
  items: HighlightItem[];
  candidates: HighlightCandidate[];
};
