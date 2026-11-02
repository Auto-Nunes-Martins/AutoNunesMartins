BEGIN;
CREATE TABLE "VehiclePhotoJob" (
  path VARCHAR(160) PRIMARY KEY,
  "vehicleId" TEXT NOT NULL,
  "vehicleCreatedAt" TIMESTAMPTZ(3) NOT NULL,
  state VARCHAR(16) NOT NULL CHECK (state IN ('UPLOADING','STAGED','DELETE_PENDING')),
  token UUID,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  reason VARCHAR(32),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- No Vehicle FK: cleanup survives deletion and explicitly protects restoration.
CREATE INDEX "VehiclePhotoJob_nextAttemptAt_idx" ON "VehiclePhotoJob" ("nextAttemptAt");
CREATE INDEX "VehiclePhotoJob_vehicleId_idx" ON "VehiclePhotoJob" ("vehicleId");
ALTER TABLE "VehiclePhotoJob" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "VehiclePhotoJob" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE "VehiclePhotoJob" FROM anon; END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE "VehiclePhotoJob" FROM authenticated; END IF;
END $$;
COMMIT;
