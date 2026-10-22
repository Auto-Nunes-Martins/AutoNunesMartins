import type { Prisma } from '@prisma/client';
import type { VehicleCreate, VehicleUpdate } from '@anm/types';
import { prisma } from '../../db.js';
import { emitActivity } from '../data/activity.js';
import { getVehicleById } from '../data/vehicle.js';
import { computeSaleFigures } from '../domain/sale.js';
import Decimal from 'decimal.js';
import { lockVehicle, recomputeSaleIfExists, saleMutation } from './saleFinancials.js';

const SOLD_STATUSES = new Set(['SOLD', 'DELIVERED']);

export class VehicleStateConflict extends Error {
  constructor(
    message: string,
    public readonly status = 409,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'VehicleStateConflict';
  }
}

function validatePrices(data: { purchasePrice?: string; salePrice?: string }): void {
  for (const value of [data.purchasePrice, data.salePrice]) {
    if (value === undefined) continue;
    let valid = false;
    try {
      const price = new Decimal(value);
      valid =
        price.isFinite() &&
        price.gte(0) &&
        price.lte('9999999999.99') &&
        price.decimalPlaces() <= 2;
    } catch {
      /* invalid decimal */
    }
    if (!valid)
      throw new VehicleStateConflict(
        'O preço deve ser um valor não negativo, com até duas casas decimais.',
        400,
      );
  }
}

export interface ActorContext {
  actorId: string;
  actorName: string;
}

function vehicleLabel(brand: string, model: string, year: number): string {
  return `${brand} ${model} (${year})`;
}

export async function createVehicle(
  data: VehicleCreate,
  actor: ActorContext,
): Promise<{ id: string }> {
  validatePrices(data);
  if (data.status && SOLD_STATUSES.has(data.status)) {
    throw new VehicleStateConflict(
      'Registe uma venda para marcar a viatura como vendida ou entregue.',
    );
  }
  const vehicle = await prisma.$transaction(async (tx) => {
    const created = await tx.vehicle.create({
      data: {
        brand: data.brand,
        model: data.model,
        year: data.year,
        fuel: data.fuel,
        mileage: data.mileage,
        vin: data.vin,
        // Matrícula already canonicalized by `licensePlatePtSchema` to
        // "XX-XX-XX" form; null when the user didn't enter one.
        licensePlate: data.licensePlate ?? null,
        purchasePrice: data.purchasePrice,
        salePrice: data.salePrice ?? null,
        status: data.status ?? 'AVAILABLE',
        acquisitionDate: data.acquisitionDate,
        description: data.description ?? null,
        pendingDocFlags: data.pendingDocFlags as unknown as Prisma.InputJsonValue,
      },
    });

    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'VEHICLE_ADDED',
      entityType: 'vehicle',
      entityId: created.id,
      message: `Viatura adicionada: ${vehicleLabel(created.brand, created.model, created.year)}`,
    });

    return created;
  });

  return { id: vehicle.id };
}

export async function updateVehicle(
  id: string, data: Omit<VehicleUpdate, 'id'>, actor: ActorContext,
): Promise<void> {
  await saleMutation(tx => updateVehicleInTransaction(tx, id, data, actor));
}

/** Shared by the single-save editor; financial corrections stay in the same transaction. */
export async function updateVehicleInTransaction(
  tx: Prisma.TransactionClient, id: string, data: Omit<VehicleUpdate, 'id' | 'licensePlate'> & { licensePlate?: string | null }, actor: ActorContext,
): Promise<void> {
  validatePrices(data);
  await lockVehicle(tx, id);
  const existing = await tx.vehicle.findUnique({ where: { id }, include: { sale: true } });
  if (!existing) throw new VehicleNotFound(id);

  const statusChanged = data.status !== undefined && data.status !== existing.status;
  if (statusChanged && existing.status === 'RETURNED') {
    throw new VehicleStateConflict(
      'A retoma devolvida está fora do stock. Regularize uma nova aquisição separadamente antes de a disponibilizar.',
    );
  }
  if (statusChanged && (existing.sale || SOLD_STATUSES.has(existing.status))) {
    throw new VehicleStateConflict(
      'Use a entrega na venda para alterar o estado, ou «Anular venda» para devolver a viatura ao stock.',
    );
  }
  if (
    data.status &&
    SOLD_STATUSES.has(data.status) &&
    !existing.sale &&
    !SOLD_STATUSES.has(existing.status)
  ) {
    throw new VehicleStateConflict(
      'Registe uma venda para marcar a viatura como vendida ou entregue.',
    );
  }
  const currentSalePrice = existing.sale?.salePrice ?? existing.salePrice;
  const pricesChanged =
    (data.purchasePrice !== undefined &&
      !new Decimal(data.purchasePrice).eq(existing.purchasePrice.toString())) ||
    (data.salePrice !== undefined &&
      (currentSalePrice === null ||
        !new Decimal(data.salePrice).eq(currentSalePrice.toString())));
  if (pricesChanged && SOLD_STATUSES.has(existing.status) && !existing.sale) {
    throw new VehicleStateConflict(
      'Esta viatura está vendida mas não tem venda registada. Regularize a venda antes de corrigir preços.',
    );
  }

  const updateData: Prisma.VehicleUpdateInput = {};
  if (data.brand !== undefined) updateData.brand = data.brand;
  if (data.model !== undefined) updateData.model = data.model;
  if (data.year !== undefined) updateData.year = data.year;
  if (data.fuel !== undefined) updateData.fuel = data.fuel;
  if (data.mileage !== undefined) updateData.mileage = data.mileage;
  if (data.vin !== undefined) updateData.vin = data.vin;
  // Pass null through explicitly so "clear matrícula" is possible — but
  // only when the caller submits an explicit empty string. The schema's
  // preprocess maps "" → undefined, so this branch is reached only with
  // an actual value (already canonicalized by Zod).
  if (data.licensePlate !== undefined) updateData.licensePlate = data.licensePlate ?? null;
  if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
  if (data.salePrice !== undefined) updateData.salePrice = data.salePrice;
  // After sale creation this field mirrors the recorded price, not publicPrice.
  if (pricesChanged && existing.sale)
    updateData.salePrice = data.salePrice ?? existing.sale.salePrice;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.acquisitionDate !== undefined) updateData.acquisitionDate = data.acquisitionDate;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.pendingDocFlags !== undefined) {
    updateData.pendingDocFlags = data.pendingDocFlags as unknown as Prisma.InputJsonValue;
  }

  const updated = await tx.vehicle.update({ where: { id }, data: updateData });
  if (pricesChanged && existing.sale) {
    await recomputeSaleIfExists(tx, id, data.salePrice);
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'SALE_UPDATED',
      entityType: 'sale',
      entityId: existing.sale.id,
      message: `Preços corrigidos e venda recalculada: ${vehicleLabel(updated.brand, updated.model, updated.year)}`,
      metadata: {
        vehicleId: id,
        action: 'SALE_PRICES_CORRECTED',
        buyerType: existing.sale.buyerType,
        purchasePrice: {
          from: existing.purchasePrice.toString(),
          to: updated.purchasePrice.toString(),
        },
        salePrice: {
          from: existing.sale.salePrice.toString(),
          to: data.salePrice ?? existing.sale.salePrice.toString(),
        },
      },
    });
  }

  if (statusChanged) {
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'VEHICLE_STATUS_CHANGED',
      entityType: 'vehicle',
      entityId: id,
      message: `Estado alterado: ${existing.status} → ${updated.status} (${vehicleLabel(updated.brand, updated.model, updated.year)})`,
      metadata: { from: existing.status, to: updated.status },
    });
  } else {
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'VEHICLE_UPDATED',
      entityType: 'vehicle',
      entityId: id,
      message: `Viatura editada: ${vehicleLabel(updated.brand, updated.model, updated.year)}`,
    });
  }
}

/**
 * Promove uma viatura DRAFT a AVAILABLE. Define o preço de venda e a
 * descrição (ambos obrigatórios) numa única transação que também emite
 * o evento VEHICLE_STATUS_CHANGED para a timeline. Falha cedo se a
 * viatura não estiver em DRAFT — não há outro caminho para AVAILABLE
 * que precise deste endpoint (o /editar genérico cobre o resto).
 */
export class VehicleNotDraft extends Error {
  constructor(
    public readonly id: string,
    public readonly currentStatus: string,
  ) {
    super(`Vehicle ${id} cannot be published from status ${currentStatus}`);
    this.name = 'VehicleNotDraft';
  }
}

export async function publishVehicle(
  id: string,
  payload: { salePrice: string; description: string },
  actor: ActorContext,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.vehicle.findUnique({ where: { id } });
    if (!existing) throw new VehicleNotFound(id);
    if (existing.status !== 'DRAFT') {
      throw new VehicleNotDraft(id, existing.status);
    }

    const updated = await tx.vehicle.update({
      where: { id },
      data: {
        salePrice: payload.salePrice,
        description: payload.description,
        status: 'AVAILABLE',
      },
    });

    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'VEHICLE_STATUS_CHANGED',
      entityType: 'vehicle',
      entityId: id,
      message: `Viatura publicada: ${vehicleLabel(updated.brand, updated.model, updated.year)} (DRAFT → AVAILABLE)`,
      metadata: { from: 'DRAFT', to: 'AVAILABLE', salePrice: payload.salePrice },
    });
  });
}

export async function deleteVehicle(id: string, actor: ActorContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.vehicle.findUnique({
      where: { id },
      include: { sale: true },
    });
    if (!existing) throw new VehicleNotFound(id);
    if (existing.sale) {
      throw new VehicleHasSale(id);
    }

    await tx.vehicle.delete({ where: { id } });
    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'VEHICLE_DELETED',
      entityType: 'vehicle',
      entityId: id,
      message: `Viatura eliminada: ${vehicleLabel(existing.brand, existing.model, existing.year)}`,
    });
  });
}

export async function getVehicleWithProfit(id: string) {
  const vehicle = await getVehicleById(prisma, id);
  if (!vehicle) return null;

  // The detail query already includes every expense. Sum those exact rows
  // with decimal arithmetic instead of issuing a second aggregate query.
  const expensesTotal = vehicle.expenses
    .reduce((total, expense) => total.plus(expense.amount.toString()), new Decimal(0))
    .toString();
  // If a Sale row exists, project figures using its persisted commission
  // so the "projeção" view matches what the sale actually pays out. If
  // there's no sale yet, commission is unknown — projection uses 0.
  const recordedPrice = vehicle.sale?.salePrice ?? vehicle.salePrice;
  const figures =
    recordedPrice !== null
      ? computeSaleFigures({
          salePrice: recordedPrice.toString(),
          purchasePrice: vehicle.purchasePrice.toString(),
          expensesTotal,
          commission: vehicle.sale?.commission.toString() ?? '0',
          buyerType: vehicle.sale?.buyerType ?? 'PARTICULAR',
        })
      : null;

  return {
    ...vehicle,
    purchasePrice: vehicle.purchasePrice.toString(),
    salePrice: vehicle.salePrice?.toString() ?? null,
    publicPrice: vehicle.publicPrice?.toFixed(2) ?? null,
    expenses: vehicle.expenses.map((e) => ({ ...e, amount: e.amount.toString() })),
    sale: vehicle.sale
      ? {
          ...vehicle.sale,
          salePrice: vehicle.sale.salePrice.toString(),
          vatAmount: vehicle.sale.vatAmount.toString(),
          commission: vehicle.sale.commission.toString(),
          realProfit: vehicle.sale.realProfit.toString(),
        }
      : null,
    // Provenance for vehicles that entered stock as a customer trade-in.
    // Surfaces a banner on the detail page linking back to the originating
    // sale; null for vehicles purchased the regular way.
    sourceTradeIn: vehicle.sourceTradeIn
      ? {
          id: vehicle.sourceTradeIn.id,
          allowanceValue: vehicle.sourceTradeIn.allowanceValue.toString(),
          sale: {
            id: vehicle.sourceTradeIn.sale.id,
            saleDate: vehicle.sourceTradeIn.sale.saleDate,
            cancelledAt: vehicle.sourceTradeIn.sale.cancelledAt,
            cancellationDecision: vehicle.sourceTradeIn.sale.cancellationDecision,
            customer: vehicle.sourceTradeIn.sale.customer,
            vehicle: vehicle.sourceTradeIn.sale.vehicle,
          },
        }
      : null,
    expensesTotal,
    figures: figures
      ? {
          margin: figures.margin.toString(),
          vatAmount: figures.vatAmount.toString(),
          commission: figures.commission.toString(),
          realProfit: figures.realProfit.toString(),
        }
      : null,
  };
}

export class VehicleNotFound extends Error {
  constructor(public readonly id: string) {
    super(`Vehicle ${id} not found`);
    this.name = 'VehicleNotFound';
  }
}

export class VehicleHasSale extends Error {
  constructor(public readonly id: string) {
    super(`Vehicle ${id} has a Sale record and cannot be deleted`);
    this.name = 'VehicleHasSale';
  }
}
