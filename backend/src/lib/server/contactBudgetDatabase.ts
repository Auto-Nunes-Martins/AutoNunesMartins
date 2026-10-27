import type { PrismaClient } from '@prisma/client';
import type { ContactBudgetDatabase } from './contactBudget.js';

export function contactBudgetDatabase(prisma: PrismaClient): ContactBudgetDatabase {
  return {
    transaction: (work) =>
      prisma.$transaction(
        (tx) => work({ query: (sql, values = []) => tx.$queryRawUnsafe(sql, ...values) }),
        { maxWait: 2000, timeout: 5000 },
      ),
  };
}
