-- Preserve every sale and its trade-in while releasing the unique active link.
ALTER TYPE "VehicleStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TABLE "Sale"
  ADD COLUMN "originalVehicleId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancellationDecision" JSONB;
UPDATE "Sale" SET "originalVehicleId" = "vehicleId";
ALTER TABLE "Sale" ALTER COLUMN "originalVehicleId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "vehicleId" DROP NOT NULL;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_originalVehicleId_fkey"
  FOREIGN KEY ("originalVehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_active_history_check" CHECK (
  ("cancelledAt" IS NULL AND "vehicleId" IS NOT NULL AND "vehicleId" = "originalVehicleId") OR
  ("cancelledAt" IS NOT NULL AND "vehicleId" IS NULL AND "cancellationReason" IS NOT NULL AND "cancelledBy" IS NOT NULL)
);
CREATE INDEX "Sale_originalVehicleId_idx" ON "Sale"("originalVehicleId");
CREATE INDEX "Sale_cancelledAt_saleDate_idx" ON "Sale"("cancelledAt", "saleDate");
ALTER TABLE "TradeIn" DROP CONSTRAINT "TradeIn_resultingVehicleId_fkey";
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_resultingVehicleId_fkey"
  FOREIGN KEY ("resultingVehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TradeIn" DROP CONSTRAINT "TradeIn_saleId_fkey";
ALTER TABLE "TradeIn" ADD CONSTRAINT "TradeIn_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A returned trade-in is a historical record, never inventory. Preserve ordinary
-- edits, but reject accidental/malicious reactivation even across concurrent APIs.
CREATE FUNCTION "protect_returned_vehicle"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status"::text = 'RETURNED' AND NEW."status"::text <> 'RETURNED' THEN
    RAISE EXCEPTION 'A retoma devolvida está fora do stock; a aquisição deve ser regularizada separadamente.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "protect_returned_vehicle" BEFORE UPDATE OF "status" ON "Vehicle"
FOR EACH ROW EXECUTE FUNCTION "protect_returned_vehicle"();
