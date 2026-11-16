import { prisma } from '../../db.js';
import Decimal from 'decimal.js';
/** Sales and commissions use the sale date. Expenses use the invoice date. */
export async function loadVatSummary(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ month: Date; payable: Decimal; deductible: Decimal }[]>`
 SELECT date_trunc('month', d)::timestamp AS month, SUM(p) AS payable, SUM(c) AS deductible FROM (
 SELECT "saleDate" AS d, "vatAmount" + COALESCE("commissionVat",0) AS p, 0::numeric AS c FROM "Sale" WHERE "cancelledAt" IS NULL
 UNION ALL SELECT "vatDate", 0, COALESCE("vatAmount",0) FROM "VehicleExpense"
 ) documents WHERE d >= ${from} AND d < ${to} GROUP BY date_trunc('month', d) ORDER BY month
 `;
  // Count sales with unconfirmed commission amounts and expenses missing invoice details.
  const pending = await prisma.$queryRaw<{ count: bigint }[]>`
 SELECT (SELECT COUNT(*) FROM "Sale" WHERE "cancelledAt" IS NULL AND "commission" <> 0 AND "commissionGross" IS NULL) +
 (SELECT COUNT(*) FROM "VehicleExpense" WHERE "vatAmount" IS NULL OR "vatDate" IS NULL) AS count
 `;
  return {
    months: rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      payable: new Decimal(r.payable).toFixed(2),
      deductible: new Decimal(r.deductible).toFixed(2),
      balance: new Decimal(r.payable).minus(r.deductible).toFixed(2),
    })),
    pendingDocuments: Number(pending[0]?.count ?? 0),
  };
}
