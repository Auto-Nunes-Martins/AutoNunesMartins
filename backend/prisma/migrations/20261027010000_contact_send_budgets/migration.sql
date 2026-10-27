-- Durable counters and idempotency metadata only; no messages, addresses or raw IPs.
CREATE TABLE "ContactBudgetCounter" (
  "key" VARCHAR(80) NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" >= 0),
  "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "ContactBudgetCounter_expiresAt_idx" ON "ContactBudgetCounter" ("expiresAt");
CREATE TABLE "ContactSendAttempt" (
  "key" VARCHAR(64) NOT NULL PRIMARY KEY CHECK ("key" ~ '^[a-f0-9]{64}$'),
  "payloadHash" VARCHAR(64) NOT NULL CHECK ("payloadHash" ~ '^[a-f0-9]{64}$'),
  "status" VARCHAR(8) NOT NULL CHECK ("status" IN ('pending','sent','failed')),
  "firstAt" TIMESTAMPTZ NOT NULL,
  "leaseUntil" TIMESTAMPTZ NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" INTEGER NOT NULL CHECK ("token" > 0)
);
CREATE INDEX "ContactSendAttempt_expiresAt_idx" ON "ContactSendAttempt" ("expiresAt");
ALTER TABLE "ContactBudgetCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactSendAttempt" ENABLE ROW LEVEL SECURITY;

-- Reuse shared CRM activity, with separate read receipts for each authenticated profile.
ALTER TYPE "ActivityType" ADD VALUE 'CONTACT_REQUEST_RECEIVED';
CREATE TABLE "ContactNotificationRead" (
  "eventId" TEXT NOT NULL REFERENCES "ActivityLog"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "readAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("eventId","userId")
);
CREATE INDEX "ContactNotificationRead_userId_idx" ON "ContactNotificationRead" ("userId");
ALTER TABLE "ContactNotificationRead" ENABLE ROW LEVEL SECURITY;

CREATE INDEX "ActivityLog_type_createdAt_idx" ON "ActivityLog" ("type","createdAt" DESC);
