import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import {
  createContactBudgetStore,
  type ContactBudgetDatabase,
  type ContactLimits,
} from '../src/lib/server/contactBudget.js';

export async function contactBudgetFixture(limits: ContactLimits = { daily: 20, monthly: 1000 }) {
  const db = await PGlite.create();
  await db.exec(`CREATE TYPE "ActivityType" AS ENUM ('VEHICLE_ADDED');
    CREATE TABLE "User" (id TEXT PRIMARY KEY, "deactivatedAt" TIMESTAMP);
    CREATE TABLE "ActivityLog" (id TEXT PRIMARY KEY, "actorId" TEXT, type "ActivityType", "entityType" TEXT, "entityId" TEXT, message TEXT, metadata JSONB, "createdAt" TIMESTAMP);`);
  await db.exec(
    readFileSync(
      new URL(
        '../prisma/migrations/20261027010000_contact_send_budgets/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  let now = new Date('2026-10-27T12:00:00Z');
  const database: ContactBudgetDatabase = {
    transaction: (work) =>
      db.transaction((tx) =>
        work({
          async query<T>(sql: string, values: unknown[] = []): Promise<T[]> {
            if (sql === 'SELECT clock_timestamp() AS now') return [{ now }] as T[];
            // Advance a deterministic database clock without using the application's wall clock.
            const adjusted = sql.replaceAll(
              'clock_timestamp()',
              "'" + now.toISOString() + "'::timestamptz",
            );
            return (await tx.query(adjusted, values)).rows as T[];
          },
        }),
      ),
  };
  const store = () =>
    createContactBudgetStore(database, 'fixture-only-relay-secret'.repeat(2), limits);
  return {
    db,
    database,
    store,
    setTime(value: string) {
      now = new Date(value);
    },
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}
