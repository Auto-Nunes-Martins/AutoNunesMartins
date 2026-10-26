import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
vi.mock('../../db.js', () => ({ prisma: {} }));
import { userLifecycleAvailable } from './userLifecycleSchema.js';
it('adds lifecycle state without changing existing profiles, task ownership or activity attribution', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "User"(id TEXT PRIMARY KEY,"clerkId" TEXT UNIQUE,email TEXT,name TEXT);CREATE UNIQUE INDEX "User_email_key" ON "User"(email);
 CREATE TABLE "Task"(id TEXT PRIMARY KEY,"assigneeId" TEXT REFERENCES "User"(id),status TEXT);
 CREATE TABLE "ActivityLog"(id TEXT PRIMARY KEY,"actorId" TEXT REFERENCES "User"(id),message TEXT);
 INSERT INTO "User" VALUES('old','clerk_old','same@example.org','Original');
 INSERT INTO "Task" VALUES('pending','old','TODO'),('done','old','DONE');INSERT INTO "ActivityLog" VALUES('log','old','Original history');`);
    const adapter = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = Prisma.sql(strings, ...values);
        return (await db.query(query.text, query.values)).rows;
      },
    };
    expect(await userLifecycleAvailable(adapter as any)).toBe(false);
    const before = await db.query(
      `SELECT u.id,u.email,u.name,t.id AS task,t."assigneeId",a."actorId" FROM "User" u JOIN "Task" t ON t."assigneeId"=u.id JOIN "ActivityLog" a ON a."actorId"=u.id ORDER BY t.id`,
    );
    await db.exec(
      readFileSync(
        new URL(
          '../../../prisma/migrations/20261026223000_deactivate_clerk_users/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    expect(
      (
        await db.query(
          `SELECT u.id,u.email,u.name,t.id AS task,t."assigneeId",a."actorId" FROM "User" u JOIN "Task" t ON t."assigneeId"=u.id JOIN "ActivityLog" a ON a."actorId"=u.id ORDER BY t.id`,
        )
      ).rows,
    ).toEqual(before.rows);
    expect((await db.query('SELECT "deactivatedAt" FROM "User"')).rows).toEqual([
      { deactivatedAt: null },
    ]);
    await db.exec(`INSERT INTO "ClerkUserDeletion"("clerkId") VALUES('unknown') ON CONFLICT DO NOTHING;INSERT INTO "ClerkUserDeletion"("clerkId") VALUES('unknown') ON CONFLICT DO NOTHING;
 UPDATE "User" SET "deactivatedAt"=CURRENT_TIMESTAMP WHERE id='old';INSERT INTO "User" VALUES('replacement','new-clerk','same@example.org','Replacement',NULL);`);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 6000);
    expect(await userLifecycleAvailable(adapter as any)).toBe(true);
    expect((await db.query('SELECT * FROM "ClerkUserDeletion"')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM "User"')).rows).toHaveLength(2);
  } finally {
    vi.restoreAllMocks();
    await db.close();
  }
}, 20000);
