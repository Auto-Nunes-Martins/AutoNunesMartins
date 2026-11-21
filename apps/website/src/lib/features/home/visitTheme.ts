type Palette = {
  panel: string;
  field: string;
  canvas: string;
  block: string;
  edge: string;
  park: string;
  water: string;
  street: string;
  route: string;
};
export type VisitTheme = Record<string, string>;
// Match the original field's alpha while retaining a faint local undertone.
const fieldWash = (color: string, alpha: string) =>
  `#${[1, 3, 5]
    .map((offset) =>
      Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.16 + 255 * 0.84)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}${alpha}`;
const theme = (p: Palette): VisitTheme => ({
  'form-panel': `${p.panel}c9`,
  field: fieldWash(p.field, '09'),
  'field-hover': fieldWash(p.field, '13'),
  'field-focus': fieldWash(p.field, '16'),
  option: p.field,
  'map-surface': p.panel,
  'map-canvas': p.canvas,
  'map-block': p.block,
  'map-edge': p.edge,
  'map-park': p.park,
  'map-water': p.water,
  'map-street': p.street,
  'map-route': p.route,
});
export const visitTheme = theme({
  panel: '#262524',
  field: '#363533',
  canvas: '#d5d4d1',
  block: '#bab9b5',
  edge: '#9b9994',
  park: '#a7a8a2',
  water: '#b0b3b1',
  street: '#f3f1ef',
  route: '#a49f97',
});
