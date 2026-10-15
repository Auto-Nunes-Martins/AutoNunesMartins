import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), sale: vi.fn() }));
vi.mock('$lib/server/customers', () => ({ customersApi: { create: mocks.create } }));
vi.mock('$lib/server/vehicles', () => ({ vehiclesApi: {} }));
vi.mock('$lib/server/sales', () => ({ salesApi: { create: mocks.sale } }));
vi.mock('$lib/server/api', () => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super('API failure');
    }
  },
}));
import { ApiError } from './api';
import { actions } from '../../routes/(app)/viaturas/[id]/vender/+page.server';
function event(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return { request: { formData: async () => fd } } as never;
}
beforeEach(() => vi.clearAllMocks());
describe('create a customer inside a sale', () => {
  it('returns the created customer for selection without creating a sale or redirecting', async () => {
    mocks.create.mockResolvedValue({ id: 'new-customer' });
    const result = await actions.createCustomer!(
      event({ name: 'Cliente Teste', nif: '123456789', phone: '912345678' }),
    );
    expect(result).toMatchObject({
      id: 'new-customer',
      customer: {
        id: 'new-customer',
        name: 'Cliente Teste',
        nif: '123456789',
        _count: { sales: 0 },
      },
    });
    expect(mocks.sale).not.toHaveBeenCalled();
  });
  it('returns validation paths before contacting the API', async () => {
    expect(await actions.createCustomer!(event({ name: '', phone: '', nif: '' }))).toMatchObject({
      status: 400,
      data: { issues: expect.arrayContaining([expect.objectContaining({ path: ['name'] })]) },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('preserves a duplicate NIF field error so the dialog can remain open', async () => {
    mocks.create.mockRejectedValue(new ApiError(409, { error: 'NIF já existe.', field: 'nif' }));
    expect(
      await actions.createCustomer!(
        event({ name: 'Cliente Teste', nif: '123456789', phone: '912345678' }),
      ),
    ).toMatchObject({ status: 409, data: { error: 'NIF já existe.', field: 'nif' } });
    expect(mocks.sale).not.toHaveBeenCalled();
  });
});
