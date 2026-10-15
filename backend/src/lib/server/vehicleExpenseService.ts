import type { Prisma } from '@prisma/client';
import type { VehicleExpenseCreate, VehicleExpenseUpdate } from '@anm/types';
import { emitActivity } from '../data/activity.js';
import { lockVehicle, recomputeSaleIfExists, saleMutation } from './saleFinancials.js';
import type { ActorContext } from './vehicleService.js';

export class SaleExistsConfirmationRequired extends Error {
  constructor(public readonly vehicleId: string) {
    super('Vehicle is already SOLD/DELIVERED. Confirmation required to modify expenses.');
    this.name = 'SaleExistsConfirmationRequired';
  }
}

export class VehicleExpenseNotFound extends Error {
  constructor(public readonly id: string) {
    super(`VehicleExpense ${id} not found`);
    this.name = 'VehicleExpenseNotFound';
  }
}

const SOLD_STATUSES = new Set(['SOLD', 'DELIVERED']);

export async function createVehicleExpense(
  data: VehicleExpenseCreate,
  actor: ActorContext,
): Promise<{ id: string; saleRecomputed: boolean }> {
  return saleMutation(async (tx) => {
    await lockVehicle(tx, data.vehicleId);
    const vehicle = await tx.vehicle.findUnique({
      where: { id: data.vehicleId },
      select: {
        status: true,
        brand: true,
        model: true,
        year: true,
        sale: { select: { id: true } },
      },
    });
    if (!vehicle) throw new Error('Vehicle not found');

    if ((vehicle.sale || SOLD_STATUSES.has(vehicle.status)) && !data.confirmedOnSold) {
      throw new SaleExistsConfirmationRequired(data.vehicleId);
    }

    const created = await tx.vehicleExpense.create({
      data: {
        vehicleId: data.vehicleId,
        category: data.category,
        description: data.description,
        amount: data.amount,
        date: data.date,
      },
    });

    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'EXPENSE_ADDED',
      entityType: 'expense',
      entityId: created.id,
      message: `Despesa adicionada: ${data.description} — ${vehicle.brand} ${vehicle.model}`,
      metadata: { vehicleId: data.vehicleId, amount: data.amount },
    });

    const saleRecomputed = await recomputeSaleIfExists(tx, data.vehicleId);

    return { id: created.id, saleRecomputed };
  });
}

export async function updateVehicleExpense(
  id: string,
  data: Omit<VehicleExpenseUpdate, 'id'>,
  actor: ActorContext,
): Promise<{ saleRecomputed: boolean }> {
  return saleMutation(async (tx) => {
    const target = await tx.vehicleExpense.findUnique({
      where: { id },
      select: { vehicleId: true },
    });
    if (!target) throw new VehicleExpenseNotFound(id);
    await lockVehicle(tx, target.vehicleId);
    const existing = await tx.vehicleExpense.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: { status: true, brand: true, model: true, sale: { select: { id: true } } },
        },
      },
    });
    if (!existing) throw new VehicleExpenseNotFound(id);

    if (
      (existing.vehicle.sale || SOLD_STATUSES.has(existing.vehicle.status)) &&
      !data.confirmedOnSold
    ) {
      throw new SaleExistsConfirmationRequired(existing.vehicleId);
    }

    const updateData: Prisma.VehicleExpenseUpdateInput = {};
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.date !== undefined) updateData.date = data.date;

    await tx.vehicleExpense.update({ where: { id }, data: updateData });

    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'EXPENSE_UPDATED',
      entityType: 'expense',
      entityId: id,
      message: `Despesa editada: ${data.description ?? existing.description}`,
      metadata: { vehicleId: existing.vehicleId },
    });

    const saleRecomputed = await recomputeSaleIfExists(tx, existing.vehicleId);

    return { saleRecomputed };
  });
}

export async function deleteVehicleExpense(
  id: string,
  confirmedOnSold: boolean,
  actor: ActorContext,
): Promise<{ saleRecomputed: boolean }> {
  return saleMutation(async (tx) => {
    const target = await tx.vehicleExpense.findUnique({
      where: { id },
      select: { vehicleId: true },
    });
    if (!target) throw new VehicleExpenseNotFound(id);
    await lockVehicle(tx, target.vehicleId);
    const existing = await tx.vehicleExpense.findUnique({
      where: { id },
      include: { vehicle: { select: { status: true, sale: { select: { id: true } } } } },
    });
    if (!existing) throw new VehicleExpenseNotFound(id);

    if ((existing.vehicle.sale || SOLD_STATUSES.has(existing.vehicle.status)) && !confirmedOnSold) {
      throw new SaleExistsConfirmationRequired(existing.vehicleId);
    }

    await tx.vehicleExpense.delete({ where: { id } });

    await emitActivity(tx, {
      actorId: actor.actorId,
      type: 'EXPENSE_UPDATED',
      entityType: 'expense',
      entityId: id,
      message: `Despesa eliminada: ${existing.description}`,
      metadata: { vehicleId: existing.vehicleId, deleted: true },
    });

    const saleRecomputed = await recomputeSaleIfExists(tx, existing.vehicleId);

    return { saleRecomputed };
  });
}
