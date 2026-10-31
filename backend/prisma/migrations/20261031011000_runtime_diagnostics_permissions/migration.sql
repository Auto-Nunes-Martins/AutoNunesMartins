-- Supabase default privileges can grant EXECUTE directly to these roles;
-- revoking PUBLIC alone does not revoke those independent grants.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON FUNCTION public.append_runtime_diagnostics(jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON FUNCTION public.append_runtime_diagnostics(jsonb) FROM authenticated;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
