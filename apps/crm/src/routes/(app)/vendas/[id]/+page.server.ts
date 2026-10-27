import { crmPath } from '$lib/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import {
  DeliveryStatusEnum,
  saleCancellationDecisionSchema,
  saleCancellationSchema,
} from '@anm/types';
import { salesApi } from '$lib/server/sales';
import { activityApi, type ActivityListResult } from '$lib/server/activity';
import { ApiError, rethrowAuthError, apiFailure } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    const [sale, resolutionContext] = await Promise.all([
      salesApi.get(event, event.params.id),
      salesApi.resolutionContext(event, event.params.id),
    ]);

    // Build the timeline by asking the activity log for every event whose
    // entity is either *this sale* or *the vehicle linked to the sale*. The
    // vehicle half is what surfaces things like "documento marcado em falta"
    // or "viatura adicionada", since the doc-checklist lives on the Vehicle
    // model (pendingDocFlags), not on the Sale. Streamed so the rest of the
    // page renders immediately.
    const timeline: Promise<ActivityListResult & { _error?: string; _status?: number }> =
      activityApi
        .list(event, {
          scope: [
            { type: 'sale', id: sale.id },
            { type: 'vehicle', id: sale.vehicle.id },
          ],
          pageSize: 100,
        })
        .catch((err) => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 100,
          pageCount: 1,
          ...apiFailure(err),
        }));

    return { sale, timeline, resolutionContext };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw error(404, 'Venda não encontrada');
    }
    rethrowAuthError(err);
    throw err;
  }
};

const deliverySchema = z.object({
  deliveryStatus: DeliveryStatusEnum,
  deliveryDate: z.string().optional(),
});

export const actions: Actions = {
  reviewCancellation: async (event) => {
    const fd = await event.request.formData();
    const parsed = saleCancellationDecisionSchema.safeParse({
      reason: fd.get('reason'),
      operation: fd.get('operation') || undefined,
      tradeInAction: fd.get('tradeInAction') || undefined,
      independentPurchasePrice: fd.get('independentPurchasePrice') || undefined,
      independentAcquisitionDate: fd.get('independentAcquisitionDate') || undefined,
    });
    if (!parsed.success)
      return fail(400, {
        cancellation: true,
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      });
    try {
      return {
        cancellation: true,
        review: await salesApi.previewCancellation(event, event.params.id, parsed.data),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        const body = err.body as { error?: string; dependencySaleId?: string } | null;
        return fail(err.status, {
          cancellation: true,
          error: body?.error ?? 'Falha ao rever a anulação.',
          dependencySaleId: body?.dependencySaleId,
        });
      }
      throw err;
    }
  },
  cancelSale: async (event) => {
    const fd = await event.request.formData();
    const parsed = saleCancellationSchema.safeParse({
      decision: {
        reason: fd.get('reason'),
        operation: fd.get('operation') || undefined,
        tradeInAction: fd.get('tradeInAction') || undefined,
        independentPurchasePrice: fd.get('independentPurchasePrice') || undefined,
        independentAcquisitionDate: fd.get('independentAcquisitionDate') || undefined,
      },
      reviewToken: fd.get('reviewToken'),
      confirmed: fd.get('confirmed') === 'yes',
      deletionConfirmation: fd.get('deletionConfirmation') || undefined,
    });
    if (!parsed.success)
      return fail(400, {
        cancellation: true,
        error: 'Reveja os efeitos e confirme explicitamente a anulação.',
      });
    try {
      const result = await salesApi.cancel(event, event.params.id, parsed.data);
      if (result.deleted) redirect(303, crmPath('/vendas?eliminada=1'));
    } catch (err) {
      if (err instanceof ApiError)
        return fail(err.status, {
          cancellation: true,
          error: (err.body as { error?: string } | null)?.error ?? 'Falha ao anular a venda.',
        });
      throw err;
    }
    redirect(303, crmPath(`/vendas/${event.params.id}`));
  },
  delivery: async (event) => {
    const fd = await event.request.formData();
    const parsed = deliverySchema.safeParse({
      deliveryStatus: (fd.get('deliveryStatus') ?? '').toString(),
      deliveryDate: (fd.get('deliveryDate') ?? '').toString() || undefined,
    });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' });
    }
    try {
      await salesApi.updateDelivery(event, event.params.id, {
        deliveryStatus: parsed.data.deliveryStatus,
        deliveryDate: parsed.data.deliveryDate ?? null,
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.status, {
          error: (err.body as { error?: string } | null)?.error ?? 'Falha.',
        });
      }
      throw err;
    }
  },
};
