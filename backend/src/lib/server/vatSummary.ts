import { prisma } from '../../db.js';
import Decimal from 'decimal.js';
/** Document dates determine the period independently of the vehicle sale date. */
export async function loadVatSummary(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<{ month: Date; payable: Decimal; deductible: Decimal }[]>`
 SELECT date_trunc('month', d)::timestamp AS month, SUM(p) AS payable, SUM(c) AS deductible FROM (
 SELECT "vatDate" AS d, "vatAmount" AS p, 0::numeric AS c FROM "Sale" WHERE "cancelledAt" IS NULL
 UNION ALL SELECT "commissionDate", COALESCE("commissionVat",0), 0 FROM "Sale" WHERE "cancelledAt" IS NULL
 UNION ALL SELECT "vatDate", 0, COALESCE("vatAmount",0) FROM "VehicleExpense"
 ) documents WHERE d >= ${from} AND d < ${to} GROUP BY date_trunc('month', d) ORDER BY month
 `;
  // Global pending count: unknown dates cannot truthfully be assigned to a selected period.
  const pending = await prisma.$queryRaw<{ count: bigint }[]>`
 SELECT (SELECT COUNT(*) FROM "Sale" WHERE "cancelledAt" IS NULL AND ("vatDate" IS NULL OR ("commission" <> 0 AND "commissionGross" IS NULL))) +
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
