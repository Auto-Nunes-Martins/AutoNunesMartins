-- Keep existing odometer readings, including genuine zero values.
ALTER TABLE "Vehicle" ALTER COLUMN "mileage" DROP NOT NULL;
