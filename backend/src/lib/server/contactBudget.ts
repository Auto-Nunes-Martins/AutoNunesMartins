import { createHmac } from 'node:crypto';

export interface ContactLimits {
  daily: number;
  monthly: number;
}
export interface BudgetQuery {
  query<T>(sql: string, values?: unknown[]): Promise<T[]>;
}
export interface ContactBudgetDatabase {
  transaction<T>(work: (tx: BudgetQuery) => Promise<T>): Promise<T>;
}
export type ContactReservation =
  | { kind: 'send'; key: string; token: number }
  | { kind: 'sent' }
  | { kind: 'limited'; retryAfter: number }
  | { kind: 'conflict' };
export interface ContactBudgetStore {
  reserve(visitor: string, requestId: string, payload: string): Promise<ContactReservation>;
  finish(
    key: string,
    token: number,
    sent: boolean,
    preview?: { name: string; subject: string },
  ): Promise<void>;
}
const WINDOW_SECONDS = 600;
const LEASE_SECONDS = 60;
const RETRY_HOURS = 23;
const RETENTION_DAYS = 35;
const MAX_ROWS = 10_000;

export function createContactBudgetStore(
  db: ContactBudgetDatabase,
  secret: string,
  limits: ContactLimits,
): ContactBudgetStore {
  const digest = (scope: string, value: string) =>
    createHmac('sha256', secret)
      .update(scope + ':' + value)
      .digest('hex');
  return {
    reserve(visitor, requestId, payload) {
      const key = digest('request', requestId);
      const payloadHash = digest('payload', payload);
      const visitorKey = 'visitor:' + digest('visitor', visitor);
      return db.transaction(async (tx) => {
        // Serialize only reservations across replicas; never hold this lock during a send.
        await tx.query(`INSERT INTO "ContactBudgetCounter" ("key","count","expiresAt")
          VALUES ('lock',0,'9999-01-01') ON CONFLICT ("key") DO NOTHING`);
        await tx.query(`SELECT "key" FROM "ContactBudgetCounter" WHERE "key"='lock' FOR UPDATE`);
        const [clock] = await tx.query<{ now: Date }>('SELECT clock_timestamp() AS now');
        if (!clock) throw new Error('Database clock unavailable');
        const current = new Date(clock.now);
        const instant = current.getTime();
        // Bounded maintenance runs without retaining IPs, addresses or message bodies.
        await tx.query(
          `DELETE FROM "ContactSendAttempt" WHERE "key" IN (
          SELECT "key" FROM "ContactSendAttempt" WHERE "expiresAt" <= $1 LIMIT 250)`,
          [current],
        );
        await tx.query(
          `DELETE FROM "ContactBudgetCounter" WHERE "key" IN (
          SELECT "key" FROM "ContactBudgetCounter"
          WHERE "key"<>'lock' AND "expiresAt" <= $1 LIMIT 250)`,
          [current],
        );
        const [attempt] = await tx.query<{
          payloadHash: string;
          status: string;
          firstAt: Date;
          leaseUntil: Date;
          token: number;
        }>('SELECT * FROM "ContactSendAttempt" WHERE "key"=$1', [key]);
        if (!attempt) {
          // A retained CRM event also prevents replay after short-lived attempt metadata expires.
          const [event] = await tx.query<{ metadata: { payloadHash?: string } }>(
            'SELECT "metadata" FROM "ActivityLog" WHERE "id"=$1',
            ['contact:' + key],
          );
          if (event)
            return event.metadata.payloadHash === payloadHash
              ? { kind: 'sent' }
              : { kind: 'conflict' };
        }
        if (attempt) {
          if (attempt.payloadHash !== payloadHash) return { kind: 'conflict' };
          if (attempt.status === 'sent') return { kind: 'sent' };
          // Resend retains idempotency for 24h; stop uncertain retries before that expires.
          if (instant - new Date(attempt.firstAt).getTime() >= RETRY_HOURS * 3_600_000)
            return { kind: 'conflict' };
          if (new Date(attempt.leaseUntil).getTime() > instant)
            return {
              kind: 'limited',
              retryAfter: Math.ceil((new Date(attempt.leaseUntil).getTime() - instant) / 1000),
            };
        }
        const dayEnd = new Date(
          Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1),
        );
        const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
        const buckets = [
          { key: visitorKey, limit: 5, end: new Date(instant + WINDOW_SECONDS * 1000) },
          { key: 'day:' + current.toISOString().slice(0, 10), limit: limits.daily, end: dayEnd },
          {
            key: 'month:' + current.toISOString().slice(0, 7),
            limit: limits.monthly,
            end: monthEnd,
          },
        ];
        const counters = await tx.query<{ key: string; count: number; expiresAt: Date }>(
          'SELECT "key","count","expiresAt" FROM "ContactBudgetCounter" WHERE "key"=ANY($1::text[])',
          [buckets.map((b) => b.key)],
        );
        let retryAfter = 0;
        for (const bucket of buckets) {
          const counter = counters.find(
            (c) => c.key === bucket.key && new Date(c.expiresAt).getTime() > instant,
          );
          if (counter && counter.count >= bucket.limit)
            retryAfter = Math.max(
              retryAfter,
              Math.ceil((new Date(counter.expiresAt).getTime() - instant) / 1000),
            );
        }
        if (retryAfter) return { kind: 'limited', retryAfter };
        const [sizes] = await tx.query<{ attempts: number; counters: number }>(
          `SELECT (SELECT count(*)::int FROM "ContactSendAttempt") AS attempts,
          (SELECT count(*)::int FROM "ContactBudgetCounter") AS counters`,
        );
        if (
          !sizes ||
          (!attempt && sizes.attempts >= MAX_ROWS) ||
          sizes.counters + buckets.filter((b) => !counters.some((c) => c.key === b.key)).length >
            MAX_ROWS
        )
          return { kind: 'limited', retryAfter: WINDOW_SECONDS };
        for (const bucket of buckets) {
          await tx.query(
            `INSERT INTO "ContactBudgetCounter" ("key","count","expiresAt") VALUES ($1,1,$2)
            ON CONFLICT ("key") DO UPDATE SET
              "count"=CASE WHEN "ContactBudgetCounter"."expiresAt" <= $3 THEN 1 ELSE "ContactBudgetCounter"."count"+1 END,
              "expiresAt"=CASE WHEN "ContactBudgetCounter"."expiresAt" <= $3 THEN EXCLUDED."expiresAt" ELSE "ContactBudgetCounter"."expiresAt" END`,
            [bucket.key, bucket.end, current],
          );
        }
        const token = (attempt?.token ?? 0) + 1;
        // Every provider attempt consumes all budgets, even on timeout or provider rejection.
        // Never refund uncertain attempts: a provider may have accepted them before a timeout.
        await tx.query(
          `INSERT INTO "ContactSendAttempt"
          ("key","payloadHash","status","firstAt","leaseUntil","expiresAt","token")
          VALUES ($1,$2,'pending',$3,$4,$5,$6)
          ON CONFLICT ("key") DO UPDATE SET "status"='pending',"leaseUntil"=EXCLUDED."leaseUntil","token"=EXCLUDED."token"`,
          [
            key,
            payloadHash,
            current,
            new Date(instant + LEASE_SECONDS * 1000),
            new Date(instant + RETENTION_DAYS * 86_400_000),
            token,
          ],
        );
        return { kind: 'send', key, token };
      });
    },
    async finish(key, token, sent, preview) {
      await db.transaction(async (tx) => {
        // Fencing prevents a delayed response overwriting a newer retry.
        const updated = await tx.query<{ key: string; payloadHash: string }>(
          `UPDATE "ContactSendAttempt" SET "status"=$3,"leaseUntil"=clock_timestamp()
          WHERE "key"=$1 AND "token"=$2 AND "status"<>'sent' RETURNING "key","payloadHash"`,
          [key, token, sent ? 'sent' : 'failed'],
        );
        if (sent && updated.length) {
          if (!preview) throw new Error('Contact notification preview missing');
          // Acceptance and one shared CRM event commit together. Receipts are per active user.
          const name = preview.name.slice(0, 120),
            subject = preview.subject.slice(0, 120);
          await tx.query(
            `INSERT INTO "ActivityLog"
            ("id","actorId","type","entityType","entityId","message","metadata","createdAt")
            VALUES ($1,NULL,'CONTACT_REQUEST_RECEIVED','contact',$2,$3,$4::jsonb,clock_timestamp())
            ON CONFLICT ("id") DO NOTHING`,
            [
              'contact:' + key,
              key,
              'Novo contacto de ' + name,
              JSON.stringify({ name, subject, payloadHash: updated[0]!.payloadHash }),
            ],
          );
        }
      });
    },
  };
}
