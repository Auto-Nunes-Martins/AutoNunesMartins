import { Prisma } from '@prisma/client';
import type { TaskStatus } from '@anm/types';

/** All task mutations share a short transaction lock, including legacy status actions. */
export async function lockTaskBoard(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(91827, 1)`;
}

const STEP = new Prisma.Decimal(1024);

export function betweenPositions(
  before: Prisma.Decimal | undefined,
  after: Prisma.Decimal | undefined,
): Prisma.Decimal | null {
  const rank =
    before && after
      ? before.plus(after).dividedBy(2).toDecimalPlaces(12)
      : before
        ? before.plus(STEP)
        : after
          ? after.minus(STEP)
          : STEP;
  if ((before && rank.lte(before)) || (after && rank.gte(after))) return null;
  return rank;
}

export async function appendTaskPosition(tx: Prisma.TransactionClient, status: TaskStatus) {
  const last = await tx.task.findFirst({
    where: { status },
    orderBy: [{ boardPosition: 'desc' }, { id: 'desc' }],
    select: { boardPosition: true },
  });
  return (last?.boardPosition ?? new Prisma.Decimal(0)).plus(STEP);
}

/**
 * Insert immediately before the next visible neighbour (or after the previous).
 * Hidden tasks keep their relative order and are never exposed in the response.
 */
export async function movedTaskPosition(
  tx: Prisma.TransactionClient,
  id: string,
  status: TaskStatus,
  beforeId: string | undefined,
  afterId: string | undefined,
) {
  const rows = await tx.task.findMany({
    where: { status, id: { not: id } },
    orderBy: [{ boardPosition: 'asc' }, { id: 'asc' }],
    select: { id: true, boardPosition: true },
  });
  const index = afterId
    ? rows.findIndex((row) => row.id === afterId)
    : beforeId
      ? rows.findIndex((row) => row.id === beforeId) + 1
      : rows.length;
  if (index < 0 || (beforeId && !rows.some((row) => row.id === beforeId))) {
    throw new Error('A validated task neighbour disappeared within the transaction');
  }
  let rank = betweenPositions(rows[index - 1]?.boardPosition, rows[index]?.boardPosition);
  if (rank) return rank;

  // Extremely dense gaps are spread without touching task metadata or versions.
  const values = rows.map((row, i) => {
    row.boardPosition = STEP.times(i + 1);
    return Prisma.sql`(${row.id}::text, ${row.boardPosition.toString()}::numeric)`;
  });
  await tx.$executeRaw`
    UPDATE "Task" AS task SET "boardPosition" = ranks.position
    FROM (VALUES ${Prisma.join(values)}) AS ranks(id, position)
    WHERE task."id" = ranks.id
  `;
  rank = betweenPositions(rows[index - 1]?.boardPosition, rows[index]?.boardPosition);
  if (!rank) throw new Error('Could not allocate a task position');
  return rank;
}
