-- Additive archive only. Existing vehicles/publication flags are not backfilled by migration.
CREATE TABLE "PublicVehicleArchive" (
  "slug" TEXT NOT NULL,
  "originKey" TEXT NOT NULL,
  "vehicleId" TEXT,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "identificationAllowed" BOOLEAN NOT NULL DEFAULT true,
  "photoAllowed" BOOLEAN NOT NULL DEFAULT true,
  "photoSourcePath" TEXT,
  "photoBytes" BYTEA,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicVehicleArchive_pkey" PRIMARY KEY ("slug"),
  CONSTRAINT "PublicVehicleArchive_photo_size" CHECK ("photoBytes" IS NULL OR octet_length("photoBytes") <= 800000)
);
CREATE INDEX "PublicVehicleArchive_vehicleId_idx" ON "PublicVehicleArchive"("vehicleId");
CREATE INDEX "PublicVehicleArchive_originKey_idx" ON "PublicVehicleArchive"("originKey");
ALTER TABLE "PublicVehicleArchive" ADD CONSTRAINT "PublicVehicleArchive_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- No anonymous/authenticated Storage/REST exposure: the backend owner performs explicit guards.
ALTER TABLE "PublicVehicleArchive" ENABLE ROW LEVEL SECURITY;
