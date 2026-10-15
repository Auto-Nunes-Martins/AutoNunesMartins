import { createHmac, timingSafeEqual } from 'node:crypto';
import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';
import {
  saleCancellationDecisionSchema,
  saleCancellationSchema,
  type SaleCancellation,
  type SaleCancellationDecision,
} from '@anm/types';
import { prisma } from '../../db.js';
import { getEnv } from '../../env.js';
import { emitActivity } from '../data/activity.js';
import { cache } from '../data/cache.js';

export class SaleCancellationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly dependencySaleId?: string,
  ) {
    super(message);
    this.name = 'SaleCancellationError';
  }
}

const cancellationInclude = {
  vehicle: { include: { expenses: { orderBy: { id: 'asc' } } } },
  customer: true,
  tradeIn: {
    include: {
      resultingVehicle: { include: { sale: true, expenses: { orderBy: { id: 'asc' } } } },
    },
  },
} satisfies Prisma.SaleInclude;
type CancellationSale = Prisma.SaleGetPayload<{ include: typeof cancellationInclude }>;

function assertCancellable(sale: CancellationSale, decision: SaleCancellationDecision) {
  if (sale.cancelledAt)
    throw new SaleCancellationError(409, 'Esta venda já foi anulada. Consulte o histórico.');
  if (!sale.tradeIn) {
    if (decision.tradeInAction) throw new SaleCancellationError(400, 'Esta venda não tem retoma.');
    return;
  }
  const trade = sale.tradeIn;
  if (trade.disposition === 'SCRAP') {
    throw new SaleCancellationError(
      409,
      'A retoma foi registada para abate/saída sem entrada em stock. Confirme e regularize essa saída antes de anular; este fluxo não pode presumir que a viatura está no stand.',
    );
  }
  const vehicle = trade.resultingVehicle;
  if (!vehicle)
    throw new SaleCancellationError(
      409,
      'A ficha de stock da retoma não está disponível. Regularize a ligação antes de anular.',
    );
  if (vehicle.sale)
    throw new SaleCancellationError(
      409,
      'A retoma tem uma venda posterior. Resolva primeiro essa venda; depois volte a anular esta venda.',
      vehicle.sale.id,
    );
  if (!['AVAILABLE', 'RESERVED', 'DOCS_PENDING', 'DRAFT'].includes(vehicle.status)) {
    throw new SaleCancellationError(
      409,
      `A retoma está indisponível (${vehicle.status}). Regularize a sua situação antes de anular.`,
    );
  }
  if (!decision.tradeInAction)
    throw new SaleCancellationError(
      400,
      'Escolha se a retoma é devolvida ao cliente ou mantida no stand.',
    );
}

function snapshot(sale: CancellationSale) {
  // Freeze the recorded deal, acquisition valuation, costs, delivery and document
  // flags. The original records/relations remain available after cancellation.
  return JSON.parse(JSON.stringify(sale)) as Prisma.InputJsonValue;
}

function reviewToken(sale: CancellationSale, decision: SaleCancellationDecision) {
  return createHmac('sha256', getEnv().CLERK_SECRET_KEY)
    .update(JSON.stringify({ purpose: 'cancel-sale-v1', snapshot: snapshot(sale), decision }))
    .digest('hex');
}

function buildReview(sale: CancellationSale, decision: SaleCancellationDecision) {
  assertCancellable(sale, decision);
  const retoma = sale.tradeIn?.resultingVehicle;
  return {
    saleId: sale.id,
    vehicleId: sale.originalVehicleId,
    decision,
    reviewToken: reviewToken(sale, decision),
    vehicle: {
      id: sale.vehicle.id,
      label: `${sale.vehicle.brand} ${sale.vehicle.model}`,
      licensePlate: sale.vehicle.licensePlate,
    },
    customer: { id: sale.customer.id, name: sale.customer.name },
    recorded: {
      salePrice: sale.salePrice.toString(),
      commission: sale.commission.toString(),
      vatAmount: sale.vatAmount.toString(),
      realProfit: sale.realProfit.toString(),
      deliveryStatus: sale.deliveryStatus,
      deliveryDate: sale.deliveryDate?.toISOString() ?? null,
    },
    tradeIn:
      sale.tradeIn && retoma
        ? {
            id: retoma.id,
            label: `${retoma.brand} ${retoma.model}`,
            licensePlate: retoma.licensePlate,
            allowanceValue: sale.tradeIn.allowanceValue.toString(),
            purchasePrice: retoma.purchasePrice.toString(),
            expensesTotal: retoma.expenses
              .reduce((total, expense) => total.plus(expense.amount.toString()), new Decimal(0))
              .toFixed(2),
            nextStatus:
              decision.tradeInAction === 'RETURN'
                ? 'RETURNED'
                : retoma.status === 'DRAFT'
                  ? 'DRAFT'
                  : 'AVAILABLE',
          }
        : null,
    effects: [
      'A venda fica anulada no histórico e deixa de contar nas vendas, entregas pendentes, indicadores e exportações de vendas activas.',
      'A viatura original volta a Disponível, sem data de venda nem reserva, e pode ser vendida novamente. Não será republicada automaticamente no site.',
      ...(retoma
        ? [
            decision.tradeInAction === 'RETURN'
              ? 'A retoma fica Devolvida ao cliente, fora do stock e do site. A ficha, fotos, documentos, despesas e ligação à venda permanecem no histórico.'
              : `A retoma fica no stand como aquisição independente por ${decision.independentPurchasePrice} €. ${retoma.status === 'DRAFT' ? 'Continua em rascunho, a aguardar preparação para venda.' : 'Volta a Disponível.'} A reserva anterior é libertada; despesas e histórico são preservados. Não será republicada automaticamente.`,
          ]
        : []),
      'Os valores e a entrega desta venda ficam preservados como histórico. As marcações de documentos/crédito e tarefas existentes permanecem para revisão manual.',
      'Este registo não confirma devolução de dinheiro, não calcula reembolsos e não efectua pagamentos. Regularize documentos, crédito e obrigações aplicáveis separadamente.',
    ],
  };
}

export async function previewSaleCancellation(saleId: string, input: SaleCancellationDecision) {
  const parsed = saleCancellationDecisionSchema.safeParse(input);
  if (!parsed.success)
    throw new SaleCancellationError(400, parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: cancellationInclude,
  });
  if (!sale) throw new SaleCancellationError(404, 'Venda não encontrada.');
  return buildReview(sale, parsed.data);
}

export async function cancelSale(
  saleId: string,
  input: SaleCancellation,
  actor: { actorId: string },
) {
  const parsed = saleCancellationSchema.safeParse(input);
  if (!parsed.success)
    throw new SaleCancellationError(
      400,
      'Reveja os efeitos, confirme a anulação e indique um motivo válido.',
    );
  const { decision, reviewToken: provided } = parsed.data;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const target = await tx.sale.findUnique({
          where: { id: saleId },
          select: { originalVehicleId: true, tradeIn: { select: { resultingVehicleId: true } } },
        });
        if (!target) throw new SaleCancellationError(404, 'Venda não encontrada.');
        // Same vehicle-row lock as financial edits/sale creation; deterministic
        // ordering prevents deadlocks between parent and subsequent trade-in sales.
        for (const id of [
          ...new Set(
            [target.originalVehicleId, target.tradeIn?.resultingVehicleId].filter(
              (id): id is string => Boolean(id),
            ),
          ),
        ].sort()) {
          await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
        }
        const sale = await tx.sale.findUnique({
          where: { id: saleId },
          include: cancellationInclude,
        });
        if (!sale) throw new SaleCancellationError(404, 'Venda não encontrada.');
        // Exact repeat is idempotent even if the original has since been resold.
        if (sale.cancelledAt) {
          const stored = sale.cancellationDecision as {
            reviewToken?: string;
            reason?: string;
            tradeInAction?: string;
            independentPurchasePrice?: string;
          } | null;
          if (
            stored?.reviewToken === provided &&
            stored.reason === decision.reason &&
            stored.tradeInAction === decision.tradeInAction &&
            stored.independentPurchasePrice === decision.independentPurchasePrice
          )
            return { vehicleId: sale.originalVehicleId, saleId, alreadyCancelled: true };
          throw new SaleCancellationError(
            409,
            'A venda já foi anulada com outra decisão. Consulte o histórico.',
          );
        }
        assertCancellable(sale, decision);
        const expected = Buffer.from(reviewToken(sale, decision));
        const submitted = Buffer.from(provided);
        if (submitted.length !== expected.length || !timingSafeEqual(submitted, expected)) {
          throw new SaleCancellationError(
            409,
            'Os dados foram alterados desde a revisão. Volte a rever os efeitos antes de confirmar.',
          );
        }
        const cancelledAt = new Date();
        const previous = snapshot(sale);
        await tx.sale.update({
          where: { id: saleId },
          data: {
            vehicleId: null,
            cancelledAt,
            cancelledBy: actor.actorId,
            cancellationReason: decision.reason,
            cancellationDecision: { ...decision, reviewToken: provided, snapshot: previous },
          },
        });
        const retoma = sale.tradeIn?.resultingVehicle;
        if (retoma) {
          await tx.vehicle.update({
            where: { id: retoma.id },
            data:
              decision.tradeInAction === 'RETURN'
                ? { status: 'RETURNED', soldDate: null, webPublished: false }
                : {
                    purchasePrice: decision.independentPurchasePrice,
                    acquisitionDate: cancelledAt,
                    status: retoma.status === 'DRAFT' ? 'DRAFT' : 'AVAILABLE',
                    soldDate: null,
                    webPublished: false,
                  },
          });
          await emitActivity(tx, {
            actorId: actor.actorId,
            type: 'VEHICLE_UPDATED',
            entityType: 'vehicle',
            entityId: retoma.id,
            message:
              decision.tradeInAction === 'RETURN'
                ? `Retoma devolvida ao cliente — venda anulada: ${decision.reason}`
                : `Retoma mantida como aquisição independente: ${decision.independentPurchasePrice} € — ${decision.reason}`,
            metadata: {
              action: decision.tradeInAction,
              saleId,
              previousPurchasePrice: retoma.purchasePrice.toString(),
              independentPurchasePrice: decision.independentPurchasePrice ?? null,
            },
          });
        }
        await tx.vehicle.update({
          where: { id: sale.originalVehicleId },
          data: { status: 'AVAILABLE', soldDate: null, webPublished: false },
        });
        await emitActivity(tx, {
          actorId: actor.actorId,
          type: 'SALE_UPDATED',
          entityType: 'sale',
          entityId: saleId,
          message: `Venda anulada: ${sale.vehicle.brand} ${sale.vehicle.model} — ${decision.reason}`,
          metadata: {
            action: 'SALE_CANCELLED',
            vehicleId: sale.originalVehicleId,
            ...decision,
            snapshot: previous,
          },
        });
        await emitActivity(tx, {
          actorId: actor.actorId,
          type: 'VEHICLE_STATUS_CHANGED',
          entityType: 'vehicle',
          entityId: sale.originalVehicleId,
          message: 'Venda anulada: viatura devolvida ao stock, sem publicação no site.',
          metadata: { saleId, from: sale.vehicle.status, to: 'AVAILABLE' },
        });
        return { vehicleId: sale.originalVehicleId, saleId, alreadyCancelled: false };
      },
      { isolationLevel: 'Serializable' },
    );
    // Clear again AFTER commit: no dashboard refill during the transaction survives.
    cache.clearPrefix('dashboard:');
    cache.clearPrefix('notifications:');
    cache.clearPrefix('search:');
    return result;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2034')
      throw new SaleCancellationError(
        409,
        'Outra operação alterou esta venda ou retoma. Volte a rever os efeitos antes de confirmar.',
      );
    throw err;
  }
}
