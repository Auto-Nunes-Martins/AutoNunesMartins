import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ preview: vi.fn(), cancel: vi.fn() }));
vi.mock('$lib/server/sales', () => ({
  salesApi: { previewCancellation: mocks.preview, cancel: mocks.cancel },
}));
vi.mock('$lib/server/activity', () => ({ activityApi: {} }));
vi.mock('$lib/server/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super('API failure');
    }
  },
}));
import { ApiError } from '$lib/server/api';
import { actions } from '../../routes/(app)/vendas/[id]/+page.server';

const event = (fields: Record<string, string | undefined>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) data.set(key, value);
  return { params: { id: 'sale' }, request: { formData: async () => data } } as never;
};
const reason = 'Cliente desistiu';
beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRM cancellation form actions', () => {
  it('requires an independent acquisition value when keeping the trade-in', async () => {
    expect(
      await actions.reviewCancellation!(event({ reason, tradeInAction: 'KEEP' })),
    ).toMatchObject({ status: 400 });
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it('submits the confirmed decision for a review and preserves a zero valuation explicitly', async () => {
    mocks.preview.mockResolvedValue({ saleId: 'sale', reviewToken: 'review-token' });
    expect(
      await actions.reviewCancellation!(
        event({ reason, tradeInAction: 'KEEP', independentPurchasePrice: '0' }),
      ),
    ).toMatchObject({ review: { reviewToken: 'review-token' } });
    expect(mocks.preview).toHaveBeenCalledWith(expect.anything(), 'sale', {
      reason,
      tradeInAction: 'KEEP',
      independentPurchasePrice: '0',
    });
  });
  it('does not confirm without a checked confirmation or review token', async () => {
    for (const fields of [
      { reason, reviewToken: 'token' },
      { reason, confirmed: 'yes' },
    ]) {
      expect(await actions.cancelSale!(event(fields))).toMatchObject({ status: 400 });
    }
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('confirms once and redirects to the retained sale history', async () => {
    mocks.cancel.mockResolvedValue({ saleId: 'sale', vehicleId: 'original' });
    await expect(
      actions.cancelSale!(
        event({ reason, confirmed: 'yes', reviewToken: 'review-token', tradeInAction: 'RETURN' }),
      ),
    ).rejects.toMatchObject({ status: 303, location: '/vendas/sale' });
    expect(mocks.cancel).toHaveBeenCalledWith(expect.anything(), 'sale', {
      decision: { reason, tradeInAction: 'RETURN' },
      confirmed: true,
      reviewToken: 'review-token',
    });
  });
  it('returns an actionable later-sale link and stale review errors without confirming', async () => {
    mocks.preview.mockRejectedValue(
      new ApiError(409, { error: 'Resolva a venda posterior.', dependencySaleId: 'later-sale' }),
    );
    expect(
      await actions.reviewCancellation!(event({ reason, tradeInAction: 'RETURN' })),
    ).toMatchObject({
      status: 409,
      data: { error: 'Resolva a venda posterior.', dependencySaleId: 'later-sale' },
    });
    mocks.cancel.mockRejectedValue(new ApiError(409, { error: 'Volte a rever os efeitos.' }));
    expect(
      await actions.cancelSale!(event({ reason, confirmed: 'yes', reviewToken: 'token' })),
    ).toMatchObject({ status: 409, data: { error: 'Volte a rever os efeitos.' } });
  });
});
