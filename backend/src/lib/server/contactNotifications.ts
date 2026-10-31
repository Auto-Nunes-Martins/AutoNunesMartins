import type { BudgetQuery } from './contactBudget.js';

export interface ContactNotification {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
  read: boolean;
}
export async function readContactNotifications(db: BudgetQuery, userId: string) {
  // Authorization is checked again in SQL so deactivated profiles never receive previews.
  const access = await db.query<{ id: string }>(
    'SELECT "id" FROM "User" WHERE "id"=$1 AND "deactivatedAt" IS NULL',
    [userId],
  );
  if (!access.length) return { unread: 0, items: [] as ContactNotification[] };
  const counts = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM "ActivityLog" e
    WHERE e."type"::text='CONTACT_REQUEST_RECEIVED' AND NOT EXISTS (
      SELECT 1 FROM "ContactNotificationRead" r WHERE r."eventId"=e."id" AND r."userId"=$1)`,
    [userId],
  );
  const rows = await db.query<{
    id: string;
    metadata: { name: string; subject: string };
    createdAt: Date;
    read: boolean;
  }>(
    `SELECT e."id",e."metadata",e."createdAt",(r."userId" IS NOT NULL) AS read
    FROM "ActivityLog" e LEFT JOIN "ContactNotificationRead" r ON r."eventId"=e."id" AND r."userId"=$1
    WHERE e."type"::text='CONTACT_REQUEST_RECEIVED' AND r."userId" IS NULL
    ORDER BY e."createdAt" DESC,e."id" DESC LIMIT 20`,
    [userId],
  );
  return {
    unread: counts[0]?.count ?? 0,
    items: rows.map((row) => ({
      id: row.id,
      name: row.metadata.name,
      subject: row.metadata.subject,
      createdAt: new Date(row.createdAt).toISOString(),
      read: row.read,
    })),
  };
}
export async function markContactNotificationRead(
  db: BudgetQuery,
  userId: string,
  eventId: string,
) {
  const rows = await db.query<{ eventId: string }>(
    `INSERT INTO "ContactNotificationRead" ("eventId","userId","readAt")
    SELECT e."id",u."id",clock_timestamp() FROM "ActivityLog" e CROSS JOIN "User" u
    WHERE e."id"=$1 AND e."type"::text='CONTACT_REQUEST_RECEIVED'
      AND u."id"=$2 AND u."deactivatedAt" IS NULL
    ON CONFLICT ("eventId","userId") DO UPDATE SET "readAt"="ContactNotificationRead"."readAt"
    RETURNING "eventId"`,
    [eventId, userId],
  );
  return rows.length > 0;
}
