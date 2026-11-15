import { expect, it } from 'vitest';
import { vehiclesFilters } from './listFilters';

it('keeps the default inventory separate while allowing pagination through all explicit drafts', () => {
  expect(vehiclesFilters(new URL('https://fixture/viaturas'))).toMatchObject({
    status: 'AVAILABLE',
    notStatus: 'DRAFT',
    page: 1,
  });
  expect(vehiclesFilters(new URL('https://fixture/viaturas?status=DRAFT&page=5'))).toMatchObject({
    status: 'DRAFT',
    notStatus: undefined,
    page: 5,
    pageSize: 25,
  });
  expect(vehiclesFilters(new URL('https://fixture/viaturas?status=AVAILABLE'))).toMatchObject({
    status: 'AVAILABLE',
    notStatus: 'DRAFT',
  });
});

it('retains the available default with search and pagination', () => {
  expect(vehiclesFilters(new URL('https://fixture/viaturas?q=BMW&page=2'))).toMatchObject({
    status: 'AVAILABLE',
    q: 'BMW',
    page: 2,
  });
});

it.each(['RESERVED', 'SOLD', 'DELIVERED', 'DOCS_PENDING', 'RETURNED'])(
  'respects the explicit %s filter',
  (status) => {
    expect(vehiclesFilters(new URL(`https://fixture/viaturas?status=${status}`)).status).toBe(
      status,
    );
  },
);

it('keeps all states available after clearing, including subsequent searches', () => {
  expect(
    vehiclesFilters(new URL('https://fixture/viaturas?status=ALL&q=BMW&page=3')),
  ).toMatchObject({
    status: undefined,
    notStatus: 'DRAFT',
    q: 'BMW',
    page: 3,
  });
});
