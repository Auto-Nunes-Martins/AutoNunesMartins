import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { movedTaskPosition } from './taskBoardOrder.js';

it('adds board order without changing business data or the previous visible sequence', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TYPE "Priority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
      CREATE TABLE "Task" (
        id TEXT PRIMARY KEY, status TEXT, priority "Priority", "dueDate" TIMESTAMP,
        "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP, "assigneeId" TEXT, title TEXT
      );
      INSERT INTO "Task" VALUES
        ('low','TODO','LOW',NULL,'2026-10-20','2026-10-20','alice','Low'),
        ('urgent-later','TODO','URGENT','2026-10-22','2026-10-20','2026-10-20',NULL,'Later'),
        ('urgent-first','TODO','URGENT','2026-10-21','2026-10-20','2026-10-20','bob','Private'),
        ('done','DONE','HIGH',NULL,'2026-10-20','2026-10-20',NULL,'Done');
    `);
    const before = await db.query('SELECT * FROM "Task" ORDER BY id');
    const previous = await db.query(`SELECT id FROM "Task" WHERE status='TODO'
      ORDER BY priority DESC,"dueDate" ASC NULLS LAST,"createdAt" DESC,id`);
    await db.exec(
      readFileSync(
        new URL(
          '../../../prisma/migrations/20261020190000_persist_task_board_order/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    expect(
      (
        await db.query(`SELECT id,status,priority,"dueDate","createdAt","updatedAt","assigneeId",title
      FROM "Task" ORDER BY id`)
      ).rows,
    ).toEqual(before.rows);
    expect(
      (await db.query(`SELECT id FROM "Task" WHERE status='TODO' ORDER BY "boardPosition",id`))
        .rows,
    ).toEqual(previous.rows);
    expect((await db.query('SELECT DISTINCT "boardVersion" FROM "Task"')).rows).toEqual([
      { boardVersion: 0 },
    ]);
    expect(
      (await db.query('SELECT "boardPosition"::text AS rank FROM "Task" WHERE id=\'done\'')).rows,
    ).toEqual([{ rank: '1024.000000000000' }]);
  } finally {
    await db.close();
  }
}, 20_000);

it('compacts exhausted ranks in PostgreSQL without changing versions or business timestamps', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`CREATE TABLE "Task" (id TEXT PRIMARY KEY, "boardPosition" NUMERIC(30,12),
      "boardVersion" INT, "updatedAt" TIMESTAMP);
      INSERT INTO "Task" VALUES ('first',1,4,'2026-10-20'),('next',1.000000000001,9,'2026-10-19');`);
    const tx = {
      task: {
        findMany: async () => {
          const result = await db.query<{ id: string; boardPosition: string }>(
            'SELECT id,"boardPosition"::text FROM "Task" ORDER BY "boardPosition"',
          );
          return result.rows.map((row) => ({
            ...row,
            boardPosition: new Prisma.Decimal(row.boardPosition),
          }));
        },
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = Prisma.sql(strings, ...values);
        return db.query(query.text, query.values);
      },
    } as unknown as Prisma.TransactionClient;
    expect((await movedTaskPosition(tx, 'moving', 'TODO', 'first', 'next')).toString()).toBe(
      '1536',
    );
    expect(
      (
        await db.query(
          'SELECT id,"boardPosition"::text,"boardVersion","updatedAt"::text FROM "Task" ORDER BY "boardPosition"',
        )
      ).rows,
    ).toEqual([
      {
        id: 'first',
        boardPosition: '1024.000000000000',
        boardVersion: 4,
        updatedAt: '2026-10-20 00:00:00',
      },
      {
        id: 'next',
        boardPosition: '2048.000000000000',
        boardVersion: 9,
        updatedAt: '2026-10-19 00:00:00',
      },
    ]);
  } finally {
    await db.close();
  }
}, 20_000);
