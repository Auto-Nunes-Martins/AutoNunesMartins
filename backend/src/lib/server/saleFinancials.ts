import type { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../../db.js';
import { cache } from '../data/cache.js';
import { sumVehicleExpenses } from '../data/vehicle.js';
import { computeSaleFigures } from '../domain/sale.js';

/** Serialize financial/status changes for one vehicle inside the transaction. */
export async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`;
}

/** Clear dependent views after commit, so an in-flight read cannot refill stale caches. */
export async function saleMutation<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const result = await prisma.$transaction(work);
  cache.clearPrefix('dashboard:');
  cache.clearPrefix('notifications:');
  cache.clearPrefix('search:');
  return result;
}

/** Persisted sale data is authoritative; never infer buyer type from defaults. */
export async function recomputeSaleIfExists(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  correctedSalePrice?: string,
): Promise<boolean> {
  const sale = await tx.sale.findUnique({ where: { vehicleId } });
  if (!sale) return false;
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { purchasePrice: true },
  });
  if (!vehicle) throw new Error('Sale vehicle not found');
  const figures = computeSaleFigures({
    salePrice: correctedSalePrice ?? sale.salePrice.toString(),
    purchasePrice: vehicle.purchasePrice.toString(),
    expensesTotal: await sumVehicleExpenses(tx, vehicleId),
    commission: sale.commission.toString(),
    buyerType: sale.buyerType,
  });
  await tx.sale.update({
    where: { id: sale.id },
    data: {
      ...(correctedSalePrice !== undefined ? { salePrice: new Decimal(correctedSalePrice) } : {}),
      vatAmount: figures.vatAmount,
      realProfit: figures.realProfit,
    },
  });
  return true;
}
