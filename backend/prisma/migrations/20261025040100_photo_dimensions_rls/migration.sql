-- Keep derived source metadata private even on installations without automatic RLS.
-- The backend database owner projects only approved cover dimensions through its API.
ALTER TABLE "VehiclePhotoDimensions" ENABLE ROW LEVEL SECURITY;
