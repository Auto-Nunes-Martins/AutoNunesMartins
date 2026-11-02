-- Retire persistence without breaking old runtimes during a rolling deployment.
-- Keep the existing signature and ACL; no input/payload is retained or inspected.
BEGIN;
SET LOCAL lock_timeout = '2000';
SET LOCAL statement_timeout = '5000';
SELECT pg_advisory_xact_lock(492108731);
CREATE OR REPLACE FUNCTION public.append_runtime_diagnostics(events jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  RETURN 0;
END;
$$;
TRUNCATE TABLE public."RuntimeDiagnosticEvent";
COMMIT;
