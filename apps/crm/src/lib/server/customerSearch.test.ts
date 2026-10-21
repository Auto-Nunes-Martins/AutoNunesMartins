import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('./customers', () => ({ customersApi: { list: mocks.list } }));
import { GET } from '../../routes/(app)/clientes/pesquisar/+server';
const event = (query: string) =>
  ({ url: new URL(`http://crm.test/clientes/pesquisar?q=${encodeURIComponent(query)}`) }) as never;
beforeEach(() => vi.clearAllMocks());
describe('customer selection search', () => {
  it('searches the backend rather than only the customers loaded in the sale form', async () => {
    mocks.list.mockResolvedValue({
      items: [{ id: 'customer-outside-initial-page', name: 'Cliente distante' }],
      total: 75,
    });
    const request = event('  distante  ');
    const response = await GET(request);
    expect(mocks.list).toHaveBeenCalledWith(request, {
      q: 'distante',
      page: 1,
      pageSize: 50,
      sortBy: 'name',
      sortDir: 'asc',
    });
    expect(await response.json()).toMatchObject({
      items: [{ id: 'customer-outside-initial-page' }],
      total: 75,
    });
  });
  it.each(['', ' ', 'x'.repeat(121)])(
    'does not query the API for empty or oversized searches',
    async (q) => {
      expect(await (await GET(event(q))).json()).toEqual({ items: [], total: 0 });
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );
});
