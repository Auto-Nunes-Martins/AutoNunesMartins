CREATE TABLE "RuntimeDiagnosticEvent" (
  "id" BIGSERIAL PRIMARY KEY,
  "eventId" UUID NOT NULL UNIQUE,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "instance" UUID NOT NULL,
  "boot" UUID NOT NULL,
  "service" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "kind" TEXT,
  "processSequence" BIGINT NOT NULL,
  "trace" UUID,
  "payload" JSONB NOT NULL
);
CREATE INDEX "RuntimeDiagnosticEvent_time_id" ON "RuntimeDiagnosticEvent" ("occurredAt", "id");
CREATE INDEX "RuntimeDiagnosticEvent_instance_time" ON "RuntimeDiagnosticEvent" ("instance", "occurredAt");
CREATE INDEX "RuntimeDiagnosticEvent_trace_time" ON "RuntimeDiagnosticEvent" ("trace", "occurredAt");
ALTER TABLE "RuntimeDiagnosticEvent" ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.append_runtime_diagnostics(events jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE inserted integer;
BEGIN
  IF jsonb_typeof(events) <> 'array' OR jsonb_array_length(events) > 32 THEN
    RAISE EXCEPTION 'Invalid diagnostic batch';
  END IF;
  IF NOT pg_try_advisory_xact_lock(492108731) THEN
    RAISE EXCEPTION 'Diagnostic writer busy' USING ERRCODE = '55P03';
  END IF;
  PERFORM set_config('lock_timeout','2000',true);
  INSERT INTO public."RuntimeDiagnosticEvent" ("eventId","occurredAt","instance","boot","service","event","kind","processSequence","trace","payload")
  SELECT "eventId"::uuid,"occurredAt"::timestamptz,"instance"::uuid,"boot"::uuid,"service","event","kind","processSequence","trace"::uuid,"payload"
  FROM jsonb_to_recordset(events) AS x("eventId" text,"occurredAt" text,"instance" text,"boot" text,"service" text,"event" text,"kind" text,"processSequence" bigint,"trace" text,"payload" jsonb)
  ON CONFLICT ("eventId") DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  DELETE FROM public."RuntimeDiagnosticEvent"
  WHERE "receivedAt" < CURRENT_TIMESTAMP - INTERVAL '7 days'
     OR "id" IN (SELECT "id" FROM (SELECT "id",row_number() OVER (ORDER BY "id" DESC) AS n,sum(pg_column_size("payload")) OVER (ORDER BY "id" DESC) AS bytes FROM public."RuntimeDiagnosticEvent") AS bounded WHERE n > 10000 OR bytes > 50000000);
  RETURN inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.append_runtime_diagnostics(jsonb) FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN GRANT EXECUTE ON FUNCTION public.append_runtime_diagnostics(jsonb) TO service_role; END IF; END $$;
NOTIFY pgrst, 'reload schema';
