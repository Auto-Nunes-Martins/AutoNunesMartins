-- Derived, optional metadata. Existing rows and publication permissions are unchanged.
CREATE TABLE "VehiclePhotoDimensions" (
    "version" VARCHAR(64) NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sourceHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehiclePhotoDimensions_pkey" PRIMARY KEY ("version"),
    CONSTRAINT "VehiclePhotoDimensions_dimensions_check" CHECK (
      "width" > 0 AND "height" > 0 AND "width"::BIGINT * "height"::BIGINT <= 24000000
    ),
    CONSTRAINT "VehiclePhotoDimensions_hashes_check" CHECK (
      "version" ~ '^[a-f0-9]{64}$' AND "sourceHash" ~ '^[a-f0-9]{64}$'
    ),
    CONSTRAINT "VehiclePhotoDimensions_vehicleId_fkey" FOREIGN KEY ("vehicleId")
      REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VehiclePhotoDimensions_vehicleId_idx" ON "VehiclePhotoDimensions"("vehicleId");
