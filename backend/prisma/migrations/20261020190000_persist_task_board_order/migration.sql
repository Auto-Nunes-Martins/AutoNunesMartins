-- Preserve the previous priority / due date / creation ordering. No business fields change.
ALTER TABLE "Task"
  ADD COLUMN "boardPosition" DECIMAL(30,12) NOT NULL DEFAULT 0,
  ADD COLUMN "boardVersion" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "status"
    ORDER BY "priority" DESC, "dueDate" ASC NULLS LAST, "createdAt" DESC, "id" ASC
  ) * 1024 AS position
  FROM "Task"
)
UPDATE "Task" AS task SET "boardPosition" = ranked.position
FROM ranked WHERE task."id" = ranked."id";

CREATE INDEX "Task_status_boardPosition_idx" ON "Task"("status", "boardPosition");
