import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), sale: vi.fn() }));
vi.mock('$lib/server/customers', () => ({
  customersApi: { create: mocks.create, update: mocks.update },
}));
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
import { actions as newCustomerActions } from '../../routes/(app)/clientes/novo/+page.server';
import { actions as editCustomerActions } from '../../routes/(app)/clientes/[id]/editar/+page.server';
function event(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return { request: { formData: async () => fd }, params: { id: 'customer' } } as never;
}
beforeEach(() => vi.clearAllMocks());

describe('international phones across customer forms', () => {
  it.each([
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0034 612 345 678', '+34612345678'],
  ])(
    'forwards normalized %s when creating, editing and creating during a sale',
    async (phone, normalized) => {
      mocks.create.mockResolvedValue({ id: 'new-customer' });
      mocks.update.mockResolvedValue({ ok: true });
      const request = event({ name: 'Cliente Teste', nif: '123456789', phone });
      await newCustomerActions.submit!(request);
      expect(mocks.create).toHaveBeenLastCalledWith(
        request,
        expect.objectContaining({ phone: normalized }),
      );
      await editCustomerActions.submit!(request);
      expect(mocks.update).toHaveBeenLastCalledWith(
        request,
        'customer',
        expect.objectContaining({ phone: normalized }),
      );
      await actions.createCustomer!(request);
      expect(mocks.create).toHaveBeenLastCalledWith(
        request,
        expect.objectContaining({ phone: normalized }),
      );
    },
  );
});
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
