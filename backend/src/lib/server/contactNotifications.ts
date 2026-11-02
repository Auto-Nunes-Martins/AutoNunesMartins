import type { BudgetQuery } from './contactBudget.js';

export interface ContactNotification {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
}
export async function readContactNotifications(db: BudgetQuery, userId: string) {
  const rows = await db.query<{
    id: string;
    metadata: { name: string; subject: string };
    createdAt: Date;
    unread: number;
  }>(
    // Count before LIMIT, in the same statement/snapshot as the displayed items.
    `SELECT e."id",e."metadata",e."createdAt",
      count(*) OVER ()::int AS unread
    FROM "ActivityLog" e
    WHERE e."type"='CONTACT_REQUEST_RECEIVED'
      AND EXISTS (SELECT 1 FROM "User" WHERE "id"=$1 AND "deactivatedAt" IS NULL)
    ORDER BY e."createdAt" DESC,e."id" DESC LIMIT 20`,
    [userId],
  );
  return {
    unread: rows[0]?.unread ?? 0,
    items: rows.map((row) => ({
      id: row.id,
      name: row.metadata.name,
      subject: row.metadata.subject,
      createdAt: new Date(row.createdAt).toISOString(),
    })),
  };
}
// Removing a notice also cascades its legacy receipts; emails and send attempts stay intact.
export async function deleteContactNotification(db: BudgetQuery, userId: string, eventId: string) {
  const rows = await db.query<{ id: string }>(
    `DELETE FROM "ActivityLog" e
    WHERE e."id"=$1 AND e."type"='CONTACT_REQUEST_RECEIVED'
      AND EXISTS (SELECT 1 FROM "User" WHERE "id"=$2 AND "deactivatedAt" IS NULL)
    RETURNING e."id"`,
    [eventId, userId],
  );
  return rows.length > 0;
}
