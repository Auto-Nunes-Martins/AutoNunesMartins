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
export const homeVisitThemes: Record<number, VisitTheme> = {
  3: theme({
    panel: '#212221',
    field: '#313230',
    canvas: '#d5d6d3',
    block: '#b8b9b5',
    edge: '#9b9d98',
    park: '#a5a7a1',
    water: '#abaead',
    street: '#f0f0ee',
    route: '#a9a59d',
  }),
  4: theme({
    panel: '#2a2b2a',
    field: '#3a3b39',
    canvas: '#e0e1df',
    block: '#c8c9c5',
    edge: '#acaeaa',
    park: '#b1b3ad',
    water: '#bdc1c0',
    street: '#fbfaf8',
    route: '#aaa69f',
  }),
  5: theme({
    panel: '#262524',
    field: '#363533',
    canvas: '#d5d4d1',
    block: '#bab9b5',
    edge: '#9b9994',
    park: '#a7a8a2',
    water: '#b0b3b1',
    street: '#f3f1ef',
    route: '#a49f97',
  }),
  6: theme({
    panel: '#242627',
    field: '#343738',
    canvas: '#dadcdc',
    block: '#bcc0c0',
    edge: '#a2a7a8',
    park: '#a7acaa',
    water: '#a7adaf',
    street: '#f3f3f3',
    route: '#aaa6a2',
  }),
  7: theme({
    panel: '#302f27',
    field: '#444338',
    canvas: '#e4dfcc',
    block: '#ccc6aa',
    edge: '#aea88b',
    park: '#bbc0a0',
    water: '#b7c6bd',
    street: '#fff9e9',
    route: '#c9b080',
  }),
};
