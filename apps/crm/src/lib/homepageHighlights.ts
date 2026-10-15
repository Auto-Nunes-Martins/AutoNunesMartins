export type HighlightItem = { vehicleId: string; photoPath: string };
export type HighlightCandidate = {
  id: string;
  brand: string;
  model: string;
  year: number;
  slug: string;
  photos: { path: string; url: string | null }[];
};
export type HighlightsEditor = {
  revision: string | null;
  items: HighlightItem[];
  candidates: HighlightCandidate[];
};
