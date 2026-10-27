import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('$env/static/public', () => ({ PUBLIC_BACKEND_URL: 'https://api.test' }));
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('$lib/server/sales', () => ({ salesApi: { create: mocks.create } }));
vi.mock('$lib/server/vehicles', () => ({ vehiclesApi: {} }));
vi.mock('$lib/server/customers', () => ({ customersApi: {} }));
import { actions } from '../../routes/(app)/viaturas/[id]/vender/+page.server';
const event = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries({
    vehicleId: 'original',
    customerId: 'customer',
    salePrice: '15000',
    saleDate: '2026-10-27',
    hasTradeIn: 'true',
    'tradeIn.brand': 'Renault',
    'tradeIn.model': 'Clio',
    'tradeIn.year': '2018',
    'tradeIn.fuel': 'DIESEL',
    'tradeIn.mileage': '120000',
    'tradeIn.licensePlate': '12ab34',
    'tradeIn.allowanceValue': '4000',
    'tradeIn.disposition': 'STOCK',
    ...fields,
  }).forEach(([key, value]) => data.set(key, value));
  return { params: { id: 'original' }, request: { formData: async () => data } } as never;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ id: 'sale' });
});
describe('trade-in sale form submission', () => {
  it('forwards normalized identification, intake notes and document flags without requiring VIN', async () => {
    expect(
      await actions.submit!(
        event({ 'tradeIn.notes': 'Revisão em falta', 'tradeIn.pendingDocFlags.docs': 'true' }),
      ),
    ).toEqual({ id: 'sale' });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tradeIn: expect.objectContaining({
          licensePlate: '12-AB-34',
          notes: 'Revisão em falta',
          pendingDocFlags: { financing: false, imt: false, registration: false, docs: true },
        }),
      }),
    );
  });
  it.each(['tradeIn.licensePlate', 'tradeIn.mileage', 'tradeIn.fuel', 'tradeIn.allowanceValue'])(
    'rejects missing %s before calling the API',
    async (field) => {
      expect(await actions.submit!(event({ [field]: '' }))).toMatchObject({ status: 400 });
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it('does not apply stock document flags to scrap and permits missing scrap plate', async () => {
    await actions.submit!(
      event({
        'tradeIn.disposition': 'SCRAP',
        'tradeIn.licensePlate': '',
        'tradeIn.pendingDocFlags.docs': 'true',
      }),
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tradeIn: expect.objectContaining({ disposition: 'SCRAP', pendingDocFlags: undefined }),
      }),
    );
  });
  it('ignores hidden trade-in input when the trade-in is disabled', async () => {
    await actions.submit!(event({ hasTradeIn: 'false', 'tradeIn.licensePlate': '' }));
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0]?.[1]?.tradeIn).toBeUndefined();
  });
});
