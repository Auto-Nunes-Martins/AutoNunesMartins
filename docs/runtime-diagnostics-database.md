# Production diagnostics in the database

The diagnostic stream is stored in `RuntimeDiagnosticEvent` in the existing database. No server-side export file or local application is required. Diagnostic collection remains opt-in through the existing `RUNTIME_DIAGNOSTICS=true`; this change does not change production flags, image quality, allocator settings or upload concurrency.

## Coverage and clocks

- API, CRM, website and supervisor: boot/shutdown, per-photo admission and phases, samples during processing, completion/failure, post-upload idle, correlated browser transfer reports, and child exit status/signal.
- Every event: UTC occurrence time, database receipt time, unique event ID, instance and process boot, strictly increasing origin-process sequence, producer monotonic clock/time origin and clock drift. A trace ties the photo's phases across services. Database IDs give receipt order; asynchronous arrival order is **not** cross-process execution order. Analyse by instance, boot, origin sequence and trace, retaining both times.
- Memory: process RSS, V8 heap, external/ArrayBuffers, native V8 statistics, Linux private/anonymous/shared/PSS/Swap, process/thread counts and CPU observations; actual cgroup usage/limit/peak/headroom, file/anonymous/kernel components and pressure/OOM counters where readable. Missing Linux information is explicit. Categories overlap and must not be added together. Mapped allocator libraries do not prove which allocator owns retained memory.
- Sharp/Vips: active/queued work, concurrency, cache observations and numeric versions; Node version and a validated deployed release hash. HTTP aggregates track active/completed/aborted requests, status classes and durations for backend photo/public-photo/other traffic, without request paths or identities.
- Collection health: bounded queue, dropped events, cumulative retries, consecutive failures, oldest pending age, last failure/success and committed batch/event counts. In managed deployment, the supervisor's persistence provider is authoritative; backend local-writer counters are inactive.

The existing cadence remains: global application snapshots about every 30 seconds (configurable), upload samples about every 250 milliseconds (configurable, in-flight peak sampled at this cadence; individual sample events throttled to five seconds), phase boundaries immediately, and idle observations every five seconds for about thirty seconds. Native Linux details are cached for at most one second, with their own observation time/age. This is targeted diagnostics, not verbatim capture of every Render console line or full heap/allocator attribution.

## Persistence and bounded overhead

Services forward sanitized batches to the supervisor over private IPC. The supervisor calls the private SQL append function over the existing database connection configuration, independently of the backend process. Its separate Prisma pool is capped at **one connection**, with two-second connection/pool acquisition limits, a 2.5-second SQL statement limit and a five-second transaction limit. It is disconnected during graceful shutdown. A backend running alone reuses its existing Prisma client. The website receives no database or Supabase credentials.

Writes happen asynchronously in batches of at most 32, with at most 256 queued events per process, a 64 KiB serialized-event limit and retry backoff up to 30 seconds. A full queue drops events and increments counters instead of blocking uploads. Theoretical queue bounds are up to 16 MiB of serialized payload per process plus one batch; typical events are much smaller. Instrumentation, including the supervisor's private SQL client, has memory/CPU cost that must be included in container measurements. Persistence health also records bounded failure classifications/SQL states, attempt duration and last failure time; raw errors, credentials and SQL parameter values are never recorded.

The production sample supplied on 31 October showed the current release, ten completed/zero failed backend and CRM uploads, zero active Sharp work/cache, but 470 supervisor write failures and zero successful batches. An empty remote API request reproduced HTTP 406/PGRST106: the project's Data API rejects `public`. Storage uploads can still succeed because Storage uses a different API. The supervisor now uses private PostgreSQL directly; no API schemas are exposed, no permission settings are broadened and no further photo upload is required to validate idle diagnostic persistence. Existing function/table migrations and retention remain unchanged. Failed in-memory batches from the old runtime cannot be recovered after it exits; the supplied production log remains evidence, not a successful database write.

The SQL function serializes writers, deduplicates by event ID, and prunes **only this diagnostic table** on each successful append: seven days from receipt, newest 10,000 rows, and 50 MB of stored payload column sizes, whichever trims first. The byte budget excludes indexes/table overhead and is not a physical disk quota. With collection stopped, old data is pruned at the next append rather than by a scheduled job. Counts and retention limit long-term growth; PostgreSQL vacuum/storage management remains external.

Shutdown attempts a bounded two-second flush. A killed process/container, prolonged network/database outage or overflow can lose pending events. Child exit markers can survive a backend-only kill because the supervisor writes separately; no process can record its own forced container termination after it has died. Use gaps, drops, cgroup counters and the next boot together; an unexplained restart alone does not prove OOM.

## Privacy and consultation

Only bounded numeric/boolean values, UUID correlations, validated timestamps/release hashes and fixed diagnostic labels are persisted. Arbitrary strings, filenames, URLs, paths, request bodies, credentials and customer data are discarded. The table has RLS with no public policies; the append RPC is revoked from PUBLIC and granted only to the existing service role (and its database owner). A following permissions migration also explicitly revokes direct grants to `anon` and `authenticated`, because Supabase default privileges can grant these independently of PUBLIC; both migrations are required and the database test reproduces those defaults.

`GET /api/diagnostics` requires an authenticated active ADMIN. It accepts UTC `from`/`to` (maximum seven days, default last hour), instance/trace/service filters and an `after` receipt-ID cursor, with 50 events per page by default and at most 100 to bound diagnostic-query memory. Responses are private and uncached. Preserve returned `from`/`to` across pages. The payload retains the source's sequence and timestamps.

For an agent with the configured database connection, run the read-only helper from `backend`:

```powershell
node scripts/runtime-diagnostic-history.mjs
node scripts/runtime-diagnostic-history.mjs --from=2026-10-31T00:00:00Z --to=2026-10-31T01:00:00Z --events
```

The first command returns only aggregate coverage; the second streams sanitized events directly from the remote database, ordered by receipt ID and bounded by an initial watermark. Neither command runs the application, writes an export file or changes production data. Concurrent retention may remove the oldest events during a long read. The collecting runtime must contain this code and the migration must have succeeded before any new records can appear. Historical Render logs are not backfilled.
