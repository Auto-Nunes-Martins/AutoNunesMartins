CREATE TABLE "VehiclePhotoCleanup" (
  "vehicleId" TEXT PRIMARY KEY,
  "photos" TEXT[] NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "VehiclePhotoCleanup_nextAttemptAt_idx" ON "VehiclePhotoCleanup"("nextAttemptAt");
ALTER TABLE "VehiclePhotoCleanup" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "VehiclePhotoCleanup" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "VehiclePhotoCleanup" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "VehiclePhotoCleanup" FROM authenticated;
  END IF;
END $$;
