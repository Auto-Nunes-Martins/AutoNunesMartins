-- Additive: preserve invoice totals and legacy net commissions. Never infer fiscal dates.
ALTER TABLE "VehicleExpense" ADD COLUMN "vatAmount" DECIMAL(12,2), ADD COLUMN "vatDate" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "commissionGross" DECIMAL(12,2), ADD COLUMN "commissionVat" DECIMAL(12,2), ADD COLUMN "commissionDate" TIMESTAMP(3), ADD COLUMN "vatDate" TIMESTAMP(3), ADD COLUMN "legacyFinancials" JSONB;
ALTER TABLE "VehicleExpense" ADD CONSTRAINT "VehicleExpense_vat_check" CHECK ("vatAmount" IS NULL OR ("vatAmount" >= 0 AND "vatAmount" <= "amount" AND "vatDate" IS NOT NULL));
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_commission_document_check" CHECK ("commissionGross" IS NULL OR ("commissionGross" >= 0 AND "commissionVat" IS NOT NULL AND ("commissionGross" = 0 OR "commissionDate" IS NOT NULL)));
CREATE INDEX "VehicleExpense_vatDate_idx" ON "VehicleExpense"("vatDate");
CREATE INDEX "Sale_vatDate_idx" ON "Sale"("vatDate");
CREATE INDEX "Sale_commissionDate_idx" ON "Sale"("commissionDate");
-- Correct active estimates atomically, retaining previous figures for audit.
UPDATE "Sale" s SET "legacyFinancials" = jsonb_build_object('vatAmount',s."vatAmount"::text,'realProfit',s."realProfit"::text,'commission',s."commission"::text),
 "vatAmount" = CASE WHEN s."buyerType" = 'COMERCIANTE' THEN 0 ELSE ROUND(GREATEST(s."salePrice"-v."purchasePrice",0)*23/123,2) END,
 "realProfit" = s."salePrice"-v."purchasePrice"-COALESCE((SELECT SUM(e."amount") FROM "VehicleExpense" e WHERE e."vehicleId"=v.id),0)+s."commission"-CASE WHEN s."buyerType" = 'COMERCIANTE' THEN 0 ELSE ROUND(GREATEST(s."salePrice"-v."purchasePrice",0)*23/123,2) END
 FROM "Vehicle" v WHERE v.id=s."vehicleId" AND s."cancelledAt" IS NULL;
