-- The vehicle's sale price is the single base price for stock, website and campaigns.
BEGIN;
-- Preserve an existing positive sale price. Rescue a legacy advertised price only
-- for unsold stock that has no valid sale price; never rewrite recorded sales.
UPDATE "Vehicle" AS v
SET "salePrice" = v."publicPrice"
WHERE (v."salePrice" IS NULL OR v."salePrice" <= 0)
  AND v."publicPrice" > 0
  AND v."status" IN ('DRAFT', 'AVAILABLE', 'RESERVED')
  AND v."soldDate" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Sale" s WHERE s."vehicleId" = v."id");

ALTER TABLE "Vehicle" DROP COLUMN "publicPrice";
COMMIT;
