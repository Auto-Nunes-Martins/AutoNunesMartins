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
import { computeSaleFigures } from '../domain/sale.js';

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
const history = {
  orderBy: { id: 'asc' },
  select: { id: true, saleDate: true, createdAt: true, cancelledAt: true },
} as const;
const cancellationInclude = {
  vehicle: { include: { sale: true, salesHistory: history, expenses: { orderBy: { id: 'asc' } } } },
  customer: true,
  tradeIn: {
    include: {
      resultingVehicle: {
        include: { sale: true, salesHistory: history, expenses: { orderBy: { id: 'asc' } } },
      },
    },
  },
} satisfies Prisma.SaleInclude;
type ResolutionSale = Prisma.SaleGetPayload<{ include: typeof cancellationInclude }>;
type Db = Prisma.TransactionClient;
async function readSale(db: Db, saleId: string): Promise<ResolutionSale | null> {
  return db.sale.findUnique({ where: { id: saleId }, include: cancellationInclude });
}
const label = (v: { brand: string; model: string }) => `${v.brand} ${v.model}`;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const total = (items: { amount: { toString(): string } }[]) =>
  items.reduce((n, item) => n.plus(item.amount.toString()), new Decimal(0)).toFixed(2);

type Dependency = {
  saleId: string;
  vehicleId: string;
  label: string;
  licensePlate: string | null;
  saleDate: string;
  salePrice: string;
  realProfit: string;
  vatAmount: string;
};
async function inspect(db: Db, sale: ResolutionSale) {
  const dependencies: Dependency[] = [];
  const followingVehicles: {
    id: string;
    label: string;
    licensePlate: string | null;
    purchasePrice: string;
    sold: boolean;
  }[] = [];
  const visited = new Set([sale.id]);
  let nextId = sale.tradeIn?.resultingVehicle?.sale?.id;
  while (nextId) {
    if (visited.has(nextId))
      throw new SaleCancellationError(
        409,
        'Existe uma ligação circular entre vendas. Regularize a origem das viaturas antes de continuar.',
      );
    visited.add(nextId);
    const next = await db.sale.findUnique({
      where: { id: nextId },
      include: {
        vehicle: true,
        tradeIn: { select: { resultingVehicle: { include: { sale: { select: { id: true } } } } } },
      },
    });
    if (!next || next.cancelledAt)
      throw new SaleCancellationError(
        409,
        'Uma venda posterior mudou. Atualize a página e reveja os efeitos.',
      );
    dependencies.push({
      saleId: next.id,
      vehicleId: next.originalVehicleId,
      label: label(next.vehicle),
      licensePlate: next.vehicle.licensePlate,
      saleDate: next.saleDate.toISOString(),
      salePrice: next.salePrice.toString(),
      realProfit: next.realProfit.toString(),
      vatAmount: next.vatAmount.toString(),
    });
    followingVehicles.push({
      id: next.vehicle.id,
      label: label(next.vehicle),
      licensePlate: next.vehicle.licensePlate,
      purchasePrice: next.vehicle.purchasePrice.toString(),
      sold: true,
    });
    const following = next.tradeIn?.resultingVehicle;
    if (following && !following.sale)
      followingVehicles.push({
        id: following.id,
        label: label(following),
        licensePlate: following.licensePlate,
        purchasePrice: following.purchasePrice.toString(),
        sold: false,
      });
    nextId = next.tradeIn?.resultingVehicle?.sale?.id;
  }
  const retoma = sale.tradeIn?.resultingVehicle;
  const movements = retoma
    ? await db.activityLog.findMany({
        where: { entityType: 'vehicle', entityId: retoma.id, type: { not: 'VEHICLE_ADDED' } },
        orderBy: { id: 'asc' },
        select: { id: true, type: true, metadata: true },
      })
    : [];
  // The resolution's own audit entry is not a new business movement.
  const subsequentMovements = movements.filter((event) => {
    const meta = event.metadata as { saleId?: string; action?: string } | null;
    return !(meta?.saleId === sale.id && ['RETURN', 'KEEP'].includes(meta.action ?? ''));
  });
  const deletionBlockers: string[] = [];
  if (sale.deliveryStatus === 'DELIVERED')
    deletionBlockers.push(
      'A venda tem uma entrega registada. Anule o negócio para preservar a entrega no histórico.',
    );
  if (
    (sale.vehicle.sale && sale.vehicle.sale.id !== sale.id) ||
    sale.vehicle.salesHistory.some(
      (s) => s.id !== sale.id && (s.saleDate > sale.saleDate || s.createdAt > sale.createdAt),
    )
  )
    deletionBlockers.push(
      'A viatura original tem uma venda posterior. Preserve o histórico através da anulação.',
    );
  if (sale.vehicle.expenses.some((e) => e.createdAt > sale.createdAt))
    deletionBlockers.push('A viatura original tem despesas registadas depois desta venda.');
  // B's movements protect B, rather than blocking correction of A when B is
  // preserved as a normal purchase. Only A's own movements block deleting A.
  const tradeInDeletionBlockers: string[] = [];
  if (retoma) {
    if (retoma.sale || retoma.salesHistory.length)
      tradeInDeletionBlockers.push(
        'A retoma tem uma venda ou histórico de vendas. A ficha e as vendas seguintes têm de ser preservadas.',
      );
    if (retoma.expenses.length)
      tradeInDeletionBlockers.push('A retoma tem despesas registadas, que devem ser preservadas.');
    if (
      subsequentMovements.length ||
      !['DRAFT', ...(sale.cancelledAt ? ['RETURNED'] : [])].includes(retoma.status)
    )
      tradeInDeletionBlockers.push('A ficha da retoma já foi alterada ou preparada para venda.');
    if (retoma.photos.length || retoma.webPublished)
      tradeInDeletionBlockers.push('A retoma já tem fotografias ou publicação no site.');
  }
  const removableTradeIn = !!retoma && !tradeInDeletionBlockers.length;
  return {
    dependencies,
    followingVehicles,
    subsequentMovements,
    deletionBlockers,
    tradeInDeletionBlockers,
    removableTradeIn,
  };
}
type Inspection = Awaited<ReturnType<typeof inspect>>;
function acquisitionDate(sale: ResolutionSale, decision: SaleCancellationDecision) {
  return decision.independentAcquisitionDate
    ? new Date(`${decision.independentAcquisitionDate}T00:00:00.000Z`)
    : (sale.tradeIn?.resultingVehicle?.acquisitionDate ?? sale.saleDate);
}
function assertResolvable(
  sale: ResolutionSale,
  decision: SaleCancellationDecision,
  info: Inspection,
) {
  if (sale.cancelledAt && decision.operation !== 'DELETE')
    throw new SaleCancellationError(409, 'Esta venda já foi anulada. Consulte o histórico.');
  if (decision.operation === 'DELETE' && info.deletionBlockers.length)
    throw new SaleCancellationError(409, info.deletionBlockers[0]!);
  if (!sale.tradeIn) {
    if (decision.tradeInAction) throw new SaleCancellationError(400, 'Esta venda não tem retoma.');
    return;
  }
  if (sale.tradeIn.disposition === 'SCRAP')
    throw new SaleCancellationError(
      409,
      'A retoma foi registada para abate/saída sem entrada em stock. Regularize essa saída antes de continuar.',
    );
  const retoma = sale.tradeIn.resultingVehicle;
  if (!retoma)
    throw new SaleCancellationError(
      409,
      'A ficha de stock da retoma não está disponível. Regularize a ligação antes de continuar.',
    );
  if (!decision.tradeInAction)
    throw new SaleCancellationError(
      400,
      'Escolha se a retoma é devolvida ao cliente ou mantida no stand.',
    );
  if (decision.tradeInAction === 'DELETE' && !info.removableTradeIn)
    throw new SaleCancellationError(
      409,
      'Só pode eliminar a ficha de retoma criada por engano enquanto não tiver despesas, vendas, fotografias ou alterações posteriores.',
    );
  if (retoma.sale && decision.tradeInAction !== 'KEEP')
    throw new SaleCancellationError(
      409,
      'A retoma já foi vendida. Mantenha-a como compra normal para preservar essa venda e as viaturas seguintes.',
      retoma.sale.id,
    );
  if (
    !sale.cancelledAt &&
    ![
      'AVAILABLE',
      'RESERVED',
      'DOCS_PENDING',
      'DRAFT',
      ...(retoma.sale ? ['SOLD', 'DELIVERED'] : []),
    ].includes(retoma.status)
  )
    throw new SaleCancellationError(
      409,
      `A retoma está indisponível (${retoma.status}). Regularize a sua situação antes de continuar.`,
    );
  if (sale.cancelledAt) {
    const stored = sale.cancellationDecision as SaleCancellationDecision | null;
    if (decision.tradeInAction !== 'DELETE' && stored?.tradeInAction !== decision.tradeInAction)
      throw new SaleCancellationError(
        409,
        'A retoma já foi regularizada na anulação. A eliminação deve preservar essa decisão e os valores atuais.',
      );
  }
  if (decision.tradeInAction === 'KEEP') {
    const date = acquisitionDate(sale, decision);
    if (date > new Date())
      throw new SaleCancellationError(400, 'A data de aquisição não pode estar no futuro.');
    if (retoma.sale && date > retoma.sale.saleDate)
      throw new SaleCancellationError(
        400,
        'A compra normal não pode ser posterior à venda da retoma.',
      );
  }
}
function token(sale: ResolutionSale, decision: SaleCancellationDecision, info: Inspection) {
  return createHmac('sha256', getEnv().CLERK_SECRET_KEY)
    .update(JSON.stringify({ purpose: 'resolve-sale-v2', sale, decision, info }))
    .digest('hex');
}
function nextFigures(sale: ResolutionSale, decision: SaleCancellationDecision) {
  const retoma = sale.tradeIn?.resultingVehicle;
  if (sale.cancelledAt || decision.tradeInAction !== 'KEEP' || !retoma?.sale) return null;
  return computeSaleFigures({
    salePrice: retoma.sale.salePrice.toString(),
    purchasePrice: decision.independentPurchasePrice!,
    expensesTotal: total(retoma.expenses),
    commission: retoma.sale.commission.toString(),
    buyerType: retoma.sale.buyerType,
  });
}
function context(sale: ResolutionSale, info: Inspection) {
  const retoma = sale.tradeIn?.resultingVehicle;
  return {
    dependencies: info.dependencies,
    followingVehicles: info.followingVehicles,
    deletionBlockers: info.deletionBlockers,
    tradeInDeletionBlockers: info.tradeInDeletionBlockers,
    canDeleteTradeIn: info.removableTradeIn,
    tradeIn: retoma
      ? {
          id: retoma.id,
          label: label(retoma),
          licensePlate: retoma.licensePlate,
          status: retoma.status,
          purchasePrice: retoma.purchasePrice.toString(),
          acquisitionDate: retoma.acquisitionDate.toISOString().slice(0, 10),
          expensesCount: retoma.expenses.length,
          expensesTotal: total(retoma.expenses),
          hasLaterSale: !!retoma.sale,
        }
      : null,
  };
}
export async function getSaleResolutionContext(saleId: string) {
  const sale = await readSale(prisma, saleId);
  if (!sale) throw new SaleCancellationError(404, 'Venda não encontrada.');
  return context(sale, await inspect(prisma, sale));
}
function buildReview(sale: ResolutionSale, decision: SaleCancellationDecision, info: Inspection) {
  assertResolvable(sale, decision, info);
  const retoma = sale.tradeIn?.resultingVehicle;
  const figures = nextFigures(sale, decision);
  const deleting = decision.operation === 'DELETE';
  return {
    ...context(sale, info),
    saleId: sale.id,
    vehicleId: sale.originalVehicleId,
    decision,
    reviewToken: token(sale, decision, info),
    vehicle: {
      id: sale.vehicle.id,
      label: label(sale.vehicle),
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
    tradeIn: retoma
      ? {
          ...context(sale, info).tradeIn!,
          allowanceValue: sale.tradeIn!.allowanceValue.toString(),
          nextStatus:
            decision.tradeInAction === 'DELETE'
              ? 'DELETED'
              : decision.tradeInAction === 'RETURN'
                ? 'RETURNED'
                : retoma.status,
          nextPurchasePrice: decision.independentPurchasePrice ?? retoma.purchasePrice.toString(),
          nextAcquisitionDate: acquisitionDate(sale, decision).toISOString().slice(0, 10),
        }
      : null,
    affectedSale:
      figures && retoma?.sale
        ? {
            id: retoma.sale.id,
            beforeProfit: retoma.sale.realProfit.toString(),
            afterProfit: figures.realProfit.toString(),
            beforeVat: retoma.sale.vatAmount.toString(),
            afterVat: figures.vatAmount.toString(),
          }
        : null,
    eliminated: deleting
      ? [
          'O registo desta venda',
          ...(decision.tradeInAction === 'DELETE'
            ? [`A ficha de retoma ${label(retoma!)}, criada por engano e sem movimentos`]
            : []),
        ]
      : [],
    preserved: [
      'A ficha e as despesas da viatura original',
      ...(!deleting
        ? ['A venda anulada e a entrega, no histórico']
        : ['O motivo, os dados anteriores e a confirmação, no registo de atividade']),
      ...(retoma && decision.tradeInAction !== 'DELETE'
        ? [
            'A ficha, despesas, fotografias e documentos da retoma',
            decision.tradeInAction === 'KEEP'
              ? 'A viatura mantida passa a ser uma compra normal, sem ligação à retoma ou ao cliente desta venda'
              : 'A devolução ao cliente fica registada, fora do stock',
          ]
        : []),
      ...(info.dependencies.length
        ? [
            'Todas as vendas e retomas seguintes, incluindo os seus preços, comissões, despesas e entregas',
          ]
        : []),
      'As tarefas, documentos e crédito pendentes, para revisão manual',
    ],
    effects: [
      deleting
        ? 'Só o registo errado desta venda é eliminado. A correção fica registada na atividade.'
        : 'Esta venda fica anulada no histórico e deixa de contar nos indicadores e exportações de vendas ativas.',
      sale.cancelledAt
        ? 'A situação atual da viatura original é preservada.'
        : 'A viatura original volta a Disponível, sem data de venda. Não é publicada automaticamente no site.',
      ...(retoma
        ? [
            decision.tradeInAction === 'RETURN'
              ? 'A retoma fica Devolvida ao cliente, fora do stock e do site. As despesas permanecem no histórico.'
              : decision.tradeInAction === 'DELETE'
                ? 'Apenas a ficha de retoma criada por engano será eliminada, depois de verificar novamente que não tem movimentos.'
                : `A retoma fica como compra normal por ${decision.independentPurchasePrice} €. ${retoma.sale ? 'A venda e a entrega seguintes continuam válidas; o lucro e o IVA dessa venda são recalculados com o custo confirmado.' : 'O estado atual da ficha é preservado.'} Não é publicada automaticamente.`,
          ]
        : []),
      'Não calcula reembolsos nem efetua pagamentos. Regularize documentos, crédito e obrigações aplicáveis separadamente.',
    ],
  };
}
export async function previewSaleCancellation(saleId: string, input: SaleCancellationDecision) {
  const parsed = saleCancellationDecisionSchema.safeParse(input);
  if (!parsed.success)
    throw new SaleCancellationError(400, parsed.error.issues[0]?.message ?? 'Dados inválidos.');
  const sale = await readSale(prisma, saleId);
  if (!sale) throw new SaleCancellationError(404, 'Venda não encontrada.');
  return buildReview(sale, parsed.data, await inspect(prisma, sale));
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
      parsed.error.issues[0]?.message ?? 'Reveja os efeitos e confirme explicitamente.',
    );
  const { decision, reviewToken: provided } = parsed.data;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const target = await tx.sale.findUnique({
          where: { id: saleId },
          select: { originalVehicleId: true, tradeIn: { select: { resultingVehicleId: true } } },
        });
        if (!target) {
          const previous = await tx.activityLog.findFirst({
            where: {
              actorId: actor.actorId,
              entityType: 'sale',
              entityId: saleId,
              metadata: { path: ['reviewToken'], equals: provided },
            },
          });
          if (decision.operation === 'DELETE' && previous)
            return {
              vehicleId: (previous.metadata as { vehicleId: string }).vehicleId,
              saleId,
              alreadyCancelled: true,
              deleted: true,
            };
          throw new SaleCancellationError(404, 'Venda não encontrada.');
        }
        for (const id of [
          ...new Set(
            [target.originalVehicleId, target.tradeIn?.resultingVehicleId].filter(
              (id): id is string => !!id,
            ),
          ),
        ].sort())
          await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
        const sale = await readSale(tx, saleId);
        if (!sale) throw new SaleCancellationError(404, 'Venda não encontrada.');
        if (sale.cancelledAt && decision.operation !== 'DELETE') {
          const stored = sale.cancellationDecision as
            | (SaleCancellationDecision & { reviewToken?: string })
            | null;
          if (
            stored?.reviewToken === provided &&
            JSON.stringify(
              Object.fromEntries(
                Object.entries(stored).filter(
                  ([key]) => !['reviewToken', 'snapshot'].includes(key),
                ),
              ),
            ) === JSON.stringify(decision)
          )
            return {
              vehicleId: sale.originalVehicleId,
              saleId,
              alreadyCancelled: true,
              deleted: false,
            };
          throw new SaleCancellationError(
            409,
            'A venda já foi anulada com outra decisão. Consulte o histórico.',
          );
        }
        const info = await inspect(tx, sale);
        const review = buildReview(sale, decision, info);
        const expected = Buffer.from(review.reviewToken),
          submitted = Buffer.from(provided);
        if (submitted.length !== expected.length || !timingSafeEqual(submitted, expected))
          throw new SaleCancellationError(
            409,
            'Os dados foram alterados desde a revisão. Volte a rever os efeitos antes de confirmar.',
          );
        const resolvedAt = new Date();
        const deleting = decision.operation === 'DELETE';
        // KEEP makes B a normal vehicle. Do not retain its former origin,
        // customer or identity in a new provenance snapshot.
        const before = json(
          deleting
            ? {
                id: sale.id,
                originalVehicleId: sale.originalVehicleId,
                customerId: sale.customerId,
                saleDate: sale.saleDate,
                salePrice: sale.salePrice,
                commission: sale.commission,
                vatAmount: sale.vatAmount,
                realProfit: sale.realProfit,
                deliveryStatus: sale.deliveryStatus,
                deliveryDate: sale.deliveryDate,
              }
            : { ...sale, ...(decision.tradeInAction === 'KEEP' ? { tradeIn: null } : {}) },
        );
        if (!sale.cancelledAt)
          await tx.sale.update({
            where: { id: saleId },
            data: {
              vehicleId: null,
              cancelledAt: resolvedAt,
              cancelledBy: actor.actorId,
              cancellationReason: decision.reason,
              cancellationDecision: { ...decision, reviewToken: provided, snapshot: before },
            },
          });
        const retoma = sale.tradeIn?.resultingVehicle;
        if (retoma && sale.tradeIn) {
          if (decision.tradeInAction === 'DELETE') {
            // Explicitly delete only this empty intake. Never delete a related sale.
            await tx.tradeIn.delete({ where: { id: sale.tradeIn.id } });
            await tx.vehicle.delete({ where: { id: retoma.id } });
          } else {
            if (!sale.cancelledAt) {
              await tx.vehicle.update({
                where: { id: retoma.id },
                data:
                  decision.tradeInAction === 'RETURN'
                    ? { status: 'RETURNED', soldDate: null, webPublished: false }
                    : {
                        purchasePrice: decision.independentPurchasePrice,
                        acquisitionDate: acquisitionDate(sale, decision),
                        webPublished: false,
                        ...(retoma.description === `Retoma da venda ${saleId}`
                          ? { description: null }
                          : {}),
                      },
              });
              const figures = nextFigures(sale, decision);
              if (figures && retoma.sale) {
                await tx.sale.update({
                  where: { id: retoma.sale.id },
                  data: { vatAmount: figures.vatAmount, realProfit: figures.realProfit },
                });
                await emitActivity(tx, {
                  actorId: actor.actorId,
                  type: 'SALE_UPDATED',
                  entityType: 'sale',
                  entityId: retoma.sale.id,
                  message:
                    'Custo de aquisição corrigido: venda e entrega preservadas; lucro e IVA recalculados.',
                  metadata: {
                    action: 'ACQUISITION_REGULARIZED',
                    previousProfit: retoma.sale.realProfit.toString(),
                    previousVat: retoma.sale.vatAmount.toString(),
                    purchasePrice: decision.independentPurchasePrice!,
                    profit: figures.realProfit.toString(),
                    vat: figures.vatAmount.toString(),
                  },
                });
              }
            }
            if (decision.tradeInAction === 'KEEP' || deleting) {
              // Remove only the acquisition receipt. Vehicle B and the sale
              // which later sold B (and received C) are different records.
              await tx.tradeIn.delete({ where: { id: sale.tradeIn.id } });
            }
            if (decision.tradeInAction === 'KEEP') {
              if (sale.cancelledAt && retoma.description === `Retoma da venda ${saleId}`)
                await tx.vehicle.update({ where: { id: retoma.id }, data: { description: null } });
              // The owner requested a normal purchase with no old origin in
              // the vehicle timeline either. Keep event identity/actor/date,
              // removing only the acquisition marker for this originating sale.
              await tx.activityLog.updateMany({
                where: {
                  entityType: 'vehicle',
                  entityId: retoma.id,
                  metadata: { path: ['saleId'], equals: saleId },
                  OR: [
                    { type: 'VEHICLE_ADDED' },
                    { type: 'VEHICLE_UPDATED', metadata: { path: ['action'], equals: 'KEEP' } },
                  ],
                },
                data: {
                  message: `Viatura adicionada como compra normal: ${label(retoma)}.`,
                  metadata: { action: 'NORMAL_PURCHASE' },
                },
              });
              await tx.activityLog.updateMany({
                where: {
                  entityType: 'sale',
                  entityId: saleId,
                  type: 'TRADE_IN_RECEIVED',
                  metadata: { path: ['resultingVehicleId'], equals: retoma.id },
                },
                data: {
                  type: 'SALE_UPDATED',
                  message: 'Entrada em stock regularizada como compra normal.',
                  metadata: { action: 'RECORD_CORRECTED' },
                },
              });
            }
          }
          await emitActivity(tx, {
            actorId: actor.actorId,
            type: decision.tradeInAction === 'DELETE' ? 'VEHICLE_DELETED' : 'VEHICLE_UPDATED',
            entityType: 'vehicle',
            entityId: retoma.id,
            message:
              decision.tradeInAction === 'DELETE'
                ? 'Ficha de retoma criada por engano eliminada, sem movimentos.'
                : decision.tradeInAction === 'RETURN'
                  ? 'Retoma devolvida ao cliente. Histórico e despesas preservados.'
                  : `Compra normal no stock: valor de entrada confirmado em ${decision.independentPurchasePrice} €.`,
            metadata: {
              action:
                decision.tradeInAction === 'KEEP' ? 'PURCHASE_CORRECTED' : decision.tradeInAction!,
              ...(decision.tradeInAction === 'RETURN' ? { saleId } : {}),
              previousPurchasePrice: retoma.purchasePrice.toString(),
              independentPurchasePrice: decision.independentPurchasePrice ?? null,
            },
          });
        }
        if (!sale.cancelledAt) {
          await tx.vehicle.update({
            where: { id: sale.originalVehicleId },
            data: { status: 'AVAILABLE', soldDate: null, webPublished: false },
          });
          await emitActivity(tx, {
            actorId: actor.actorId,
            type: 'VEHICLE_STATUS_CHANGED',
            entityType: 'vehicle',
            entityId: sale.originalVehicleId,
            message: 'Venda anulada: viatura devolvida ao stock, sem publicação no site.',
            metadata: { saleId, from: sale.vehicle.status, to: 'AVAILABLE' },
          });
        }
        if (deleting) await tx.sale.delete({ where: { id: saleId } });
        if (deleting && sale.customer.lastContactDate?.getTime() === sale.saleDate.getTime()) {
          const creation = await tx.activityLog.findFirst({
            where: { entityType: 'sale', entityId: saleId, type: 'SALE_CREATED' },
            orderBy: { createdAt: 'asc' },
          });
          const metadata = creation?.metadata as Record<string, unknown> | null;
          const remaining = await tx.sale.findFirst({
            where: { customerId: sale.customerId },
            orderBy: { saleDate: 'desc' },
            select: { saleDate: true },
          });
          // Restore the recorded previous contact, retaining any later sales.
          // Legacy entries without this evidence cannot safely restore a date.
          if (metadata && Object.hasOwn(metadata, 'previousLastContactDate')) {
            const previous =
              typeof metadata.previousLastContactDate === 'string'
                ? new Date(metadata.previousLastContactDate)
                : null;
            const restored =
              remaining && (!previous || remaining.saleDate > previous)
                ? remaining.saleDate
                : previous;
            await tx.customer.updateMany({
              where: { id: sale.customerId, lastContactDate: sale.saleDate },
              data: { lastContactDate: restored },
            });
          }
        }
        await emitActivity(tx, {
          actorId: actor.actorId,
          type: 'SALE_UPDATED',
          entityType: 'sale',
          entityId: saleId,
          message: `${deleting ? 'Registo de venda eliminado por engano' : 'Venda anulada'}: ${label(sale.vehicle)} — ${decision.reason}`,
          metadata: {
            action: deleting ? 'SALE_DELETED' : 'SALE_CANCELLED',
            vehicleId: sale.originalVehicleId,
            ...decision,
            reviewToken: provided,
            snapshot: before,
            eliminated: review.eliminated,
            preserved: review.preserved,
          },
        });
        return {
          vehicleId: sale.originalVehicleId,
          saleId,
          alreadyCancelled: !!sale.cancelledAt,
          deleted: deleting,
        };
      },
      { isolationLevel: 'Serializable' },
    );
    cache.clearPrefix('dashboard:');
    cache.clearPrefix('notifications:');
    cache.clearPrefix('search:');
    return result;
  } catch (err) {
    if (['P2034', 'P2003', 'P2014'].includes((err as { code?: string }).code ?? ''))
      throw new SaleCancellationError(
        409,
        'Outra operação alterou esta venda ou retoma. Volte a rever os efeitos antes de confirmar.',
      );
    throw err;
  }
}
