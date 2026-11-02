-- DEFERRED: do not move into migrations or execute until EVERY old runtime/replica
-- is stopped and the telemetry-free release is running. Startup migrations run
-- before the new runtime; leaving this outside that directory is intentional.
BEGIN;
SET LOCAL lock_timeout = '2000';
SET LOCAL statement_timeout = '5000';
SELECT pg_advisory_xact_lock(492108731);
DROP FUNCTION public.append_runtime_diagnostics(jsonb);
-- RESTRICT is deliberate: stop if unexpected dependencies exist. No CASCADE.
DROP TABLE public."RuntimeDiagnosticEvent" RESTRICT;
COMMIT;
