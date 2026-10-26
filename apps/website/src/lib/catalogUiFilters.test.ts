import { describe, expect, it } from 'vitest';
import { catalogUiParams, catalogYearOptions, normalizeCatalogUi } from './catalogUiFilters';

describe('visible public catalog filters', () => {
  it('removes invisible filters and resets the page, retaining supported filters and unknown validation inputs', () => {
    const clean = normalizeCatalogUi(
      new URLSearchParams(
        'marca=Audi&modelo=A3&preco_min=1000&preco_max=30000&km_min=1&km_max=50000&transmissao=MANUAL&combustivel=DIESEL&pagina=2&unknown=x',
      ),
    );
    expect(clean.toString()).toBe('marca=Audi&preco_max=30000&combustivel=DIESEL&unknown=x');
  });
  it('sets only the inclusive minimum year and clears it through the single chip', () => {
    const selected = catalogUiParams(new URLSearchParams('marca=Audi&pagina=2'), 'ano_min', '2022');
    expect(selected.toString()).toBe('marca=Audi&ano_min=2022');
    expect(catalogUiParams(selected, 'ano_min', '').toString()).toBe('marca=Audi');
  });
  it.each(['ano_min=2020&ano_max=2024', 'ano_min=2020&ano_max=2020'])(
    'retains the minimum and removes obsolete upper bounds: %s',
    (query) => {
      expect(normalizeCatalogUi(new URLSearchParams(query + '&pagina=3')).toString()).toBe(
        'ano_min=2020',
      );
    },
  );
  it('retains minimum years and pagination without normalization loops', () => {
    const params = new URLSearchParams('ano_min=2023&pagina=2');
    expect(normalizeCatalogUi(params).toString()).toBe(params.toString());
  });
  it('removes an upper-bound-only legacy filter without inventing a lower bound', () => {
    expect(normalizeCatalogUi(new URLSearchParams('ano_max=2024&pagina=2')).toString()).toBe('');
  });
  it('offers descending years within API bounds and keeps the selected year visible on empty results', () => {
    expect(catalogYearOptions({ min: 2021, max: 2023 }).map((x) => x.value)).toEqual([
      '2023',
      '2022',
      '2021',
    ]);
    expect(catalogYearOptions({ min: null, max: null }, '2020')).toEqual([
      { value: '2020', label: '2020' },
    ]);
    expect(catalogYearOptions({ min: null, max: null })).toEqual([]);
  });
});
