import { expect, it } from 'vitest';
import { vehiclesFilters } from './listFilters';

it('keeps the default inventory separate while allowing pagination through all explicit drafts', () => {
  expect(vehiclesFilters(new URL('https://fixture/viaturas'))).toMatchObject({ notStatus: 'DRAFT', page: 1 });
  expect(vehiclesFilters(new URL('https://fixture/viaturas?status=DRAFT&page=5'))).toMatchObject({ status: 'DRAFT', notStatus: undefined, page: 5, pageSize: 25 });
  expect(vehiclesFilters(new URL('https://fixture/viaturas?status=AVAILABLE'))).toMatchObject({ status: 'AVAILABLE', notStatus: 'DRAFT' });
});
