# Public photo reads and backend memory — 1 November 2026

## Scope and production identity

Read-only investigation, without uploads, customer-data mutations, restart, configuration changes or deployment. The existing upload isolation is already deployed; this investigation does not repeat it or change the WebP84 recipe, masters, derivatives, publication selection or cache policy.

The observed diagnostic instance was `d7dc74f7-8370-4314-a051-0808bc82394a`, backend PID 62 / boot `705f0427-fbf8-48ac-b055-0ed3efd54b1f`. Its gateway reports release `fd74ae47d9a93e4fc3ea5f2c8f3e33142567a486`. Child processes do not receive the release environment variable, so use the gateway's `native.release` together with instance and boot when comparing samples.

`https://autonunesmartins.com/healthz` redirected to the canonical `https://www.autonunesmartins.com/healthz`, which returned `200 {"ok":true}`, `X-Render-Origin-Server: Render`, and the gateway's private/no-store health headers. The canonical public catalogue and photo delivery returned the expected application schema and `gateway-v2` delivery/version headers. Concurrent traffic prevented uniquely matching our individual requests to a single increment in the 30-second aggregate.

All times below are UTC, also Lisbon time on this date. MiB means bytes divided by 1,048,576.

## Existing evidence

The hourly samples show backend RSS approximately 67 → 238 MiB while its observed heap remains approximately 22.5 → 28.7 MiB. Startup rows lacking the HTTP provider are excluded from the following paired comparison; do not attribute that startup growth to photo traffic.

For 716 backend snapshots with HTTP counters, adjacent pairs from the same PID and boot were grouped by counter increments:

| Adjacent-pair group | Intervals | Net RSS change | Net heap change | Net anonymous-memory change |
| --- | ---: | ---: | ---: | ---: |
| No backend HTTP increment | 660 | −0.40 MiB | −1.16 MiB | +4.06 MiB |
| HTTP increment, no public-photo-route increment | 28 | +2.66 MiB | +7.01 MiB | +3.44 MiB |
| Public-photo-route counter increment | 27 | +125.21 MiB | −0.62 MiB | +121.50 MiB |

The longest uninterrupted no-HTTP window was 08:28:04–09:14:34: 93 intervals / 46 minutes 30 seconds, RSS +0.13 MiB, heap +0.16 MiB, anonymous memory +0.05 MiB. This strongly weakens a timer-only explanation for that window. Persistence queues were effectively empty and writes healthy; the old failed diagnostic backlog is not demonstrated here.

`publicPhotos` is a lifetime request counter, not unique images, people or native operations. Its path classifier also includes `/photos/access`, HEAD, conditional responses and repeated requests. Background thumbnail warming can perform Storage/native work without a separate inbound HTTP request. A diagnostic `idle` label only excludes upload activity; it does not mean no HTTP traffic.

The paired differences establish temporal association with public photo routes, not attribution to Sharp, an allocator, Storage or a specific image. Sum-of-process RSS includes shared mappings and is not cgroup usage. RSS minus JavaScript heap is not a measurement of fragmentation.

## Bounded live checks

Only one public catalogue request (`pageSize=1`) and three GETs of the same existing approved principal photo at width 800 were sent, in addition to the two health/redirect checks. No browser page was loaded, avoiding automatic fan-out from a browser. Photo references, Storage paths and image bytes are not recorded in this document.

- 10:21:44: photo GET returned 200 / 116,510 bytes, matching public version, Render and `gateway-v2`. Server-Timing reported cache miss, Storage 231.2 ms and total 253.5 ms.
- The corresponding 10:21:34–10:22:04 snapshot interval also contained 46 backend requests / 38 public-photo-route requests. RSS −6.50 MiB, heap −5.90 MiB, external −3.01 MiB, anonymous memory −6.34 MiB. The individual miss did not produce an attributable RSS increase.
- A conditional repeat returned an empty body; the local collector failed to handle the null body before recording its response status/timing. This was a collector error, not evidence of an application failure. It was not treated as a measured cache-hit result.
- 10:23:43: final GET returned 200 / 116,510 bytes, matching version and `gateway-v2`; Server-Timing explicitly reported cache hit and total 22.2 ms.
- The 10:23:34–10:24:04 interval contained 60 requests / 56 public-photo-route requests. RSS +13.50 MiB, anonymous memory +13.60 MiB, heap −0.12 MiB, external −0.99 MiB and cgroup +13.51 MiB. This cannot be assigned to our cache-hit request while other reads were occurring.

Upload counters, Sharp queue/processing/cache and OOM counters remained zero in these samples. The experiment stopped at three photo GETs; requests were not repeated to force growth. The live result is inconclusive for per-operation causality.

## What the read path actually does

- A valid width cache hit returns the existing Buffer before Storage or Sharp work.
- A thumbnail miss downloads a derivative and calls `inspectDerivative` with its default `decode=false`: container validation plus `sharp.metadata()`. Full-pixel `.stats()` validation is performed when creating variants, not again on delivery.
- A missing/invalid derivative can fall back to a master. `sanitizePhotoMetadata` uses `sharp.metadata()` and JavaScript container filtering, without pixel re-encoding.
- A manifest miss downloads the small sidecar and reads its metadata with Sharp.
- Concurrent reads of the same path and width share one pending read. Different widths have different keys. Thumbnail warming has two concurrent reads and a bounded queue.

The installed Sharp 0.34.5 source describes `metadata()` as header access without decoding compressed pixel data, consistent with the [official metadata documentation](https://sharp.pixelplumbing.com/api-input/#metadata). Native allocation remains possible; a full-pixel decode in the public delivery path has not been demonstrated.

## Observability patch and activation

The patch was prepared and reviewed locally, then published in `b1e6d8b8d1527dbb4881ab6e1b06a132c9a40978`. Production already has `RUNTIME_DIAGNOSTICS=true`; the new `native.photoreads` provider joins the existing application snapshots. It adds no timer, event per photo, queue, URL/ID map, database migration or new flag. Disabled diagnostics do not sample memory or clocks.

Fixed numeric counters distinguish byte-cache hit/miss, pending-read deduplication, manifest hit/miss/deduplication, fallback and background warming. Seven fixed phases separate manifest/derivative/master Storage downloads, Blob-to-Buffer materialization, manifest metadata, derivative metadata validation and master sanitization. Manifest helpers are shared with maintenance/upload code; their counts are not exclusively public HTTP requests.

Each phase records started/completed/failed/active/peak counts, duration and observed process-wide RSS/heap/external differences. Completed includes failures. Differences can include concurrent work and delayed collection; do not sum overlapping phase deltas as attributed allocation. `overlappedSamples` marks overlap with another measured phase, not exclusivity from HTTP, Prisma or other runtime work. `masterSanitize` includes both metadata and JavaScript filtering. Failed counts are rejected/thrown operations; a Storage SDK result containing an error is still a fulfilled operation.

Counters are lifetime aggregates for one process boot, with finite saturation and fixed structure. Compare increments between snapshots with identical PID/boot; there is no reset timer. Nested phase metrics fit the existing sanitizer depth and 64 KiB payload limit, verified through the real provider and sanitizer in tests.

The provider has 105 numeric fields: 14 counters and seven phases with 13 metrics each. Its JSON is 1,974 bytes initially and 3,549 bytes with every number at `Number.MAX_SAFE_INTEGER`; that saturated structure also survives sanitization unchanged. The fixed numeric shape stays conservatively below 8 KiB. Backend registration uses five of the eight available provider slots (the existing persistence registrations replace the same named slot). A typical cold thumbnail has three measured phases / six `process.memoryUsage()` and six clock calls; a byte-cache hit has no memory/clock sampling. Disabled mode retains only flag checks and small async wrappers around the existing operations. No per-photo smaps, `/proc` inventory or filesystem inspection is added.

Validation: 39 focused tests passed (provider, reusable variants, delivery metadata), plus backend typecheck. Tests cover opt-out overhead, bounded serialized structure, signed deltas, overlap/errors/finally, cache hits avoiding Sharp, deduplicated cold reads and background warming. No causal fix to image delivery has been claimed.

## Measurements after activation, 10:38–10:44 UTC

The final release `5b8d43e146fcd01aeda010f695fae1d31d5e93bf` (which also contains the authorized photo-framing and notification fixes) appeared at 10:38:05.433 in instance `94c904f3-b7c2-41c6-a7b5-52b2255407c4`, backend PID 61 / boot `600077c4-21c8-4d90-9ec0-578bf203e5ca`. All seven phases and all counters were persisted initially at zero. Public health returned 200 / Render / `{"ok":true}`. Do not compare the restarted process's lower RSS with the old boot as evidence of a memory fix.

Three bounded photo GETs were made against the same existing approved photo, without browser fan-out, upload, cache reset or cache-busting identity:

| Operation | Result | Attribution window |
| --- | --- | --- |
| 10:39:57, width 800 | 200 / 116,510 bytes / cache miss | Exactly one HTTP request and one photo read; no warming, overlapping measured phases, errors or uploads |
| 10:40:42, same width, conditional | 304 / zero bytes / cache hit | Other natural master-photo reads occurred in the same aggregate interval; their work is separate from this cache hit |
| 10:43:49, existing width 384 variant | 200 / 34,342 bytes / cache miss | Exactly one HTTP request and one photo read, after two quiet snapshots with unchanged counters and zero active work |

The first operation's observed phase deltas were:

| Phase | Duration | RSS | Heap used | External |
| --- | ---: | ---: | ---: | ---: |
| Derivative download | 347.25 ms | +9.434 MiB | +0.738 MiB | +0.320 MiB |
| Blob-to-Buffer materialization | 1.03 ms | +0.250 MiB | +0.0066 MiB | +0.2222 MiB |
| Derivative metadata validation | 2.53 ms | −1.301 MiB | +0.0956 MiB | 0 |

Across the containing snapshots, backend RSS increased 3.934 MiB, heap used 0.876 MiB, external 0.092 MiB and anonymous memory 2.773 MiB. V8 physical heap also increased 1.164 MiB and heap total 1.398 MiB: RSS outside **used** heap alone does not establish a non-V8 allocation. The phase deltas are not an accounting partition of the final snapshot delta.

The second cold download (smaller width-384 file) had download RSS +0.125 MiB, materialization RSS zero and metadata RSS zero, with no measured overlap. Its containing interval was exactly one request: RSS +0.125 MiB, external −2.287 MiB and heap used −0.098 MiB. During 10:44:05–10:44:35 there were zero new requests, zero active requests at both ends, unchanged phase counters and unchanged RSS. OOM counters remained zero.

This does not reproduce the first download's large increase on every small cold read. It is consistent with initial warm-up/reuse, but compares different sizes and does not establish TLS, allocator or SDK causality. The earlier multi-hour growth remains unresolved. Natural master reads also produced materialization/sanitization deltas largely accompanied by external-buffer growth; neither their content nor identities were logged.

A false idle interpretation was excluded: at 10:41:05 one master download was still active, and its later Buffer/sanitization phases appeared by 10:41:35 despite no **new** HTTP starts. Compare both active/completed counts and phase counters before declaring an interval quiet.

Source audit: the installed Storage SDK's `BlobDownloadBuilder` awaits `response.blob()`; the application subsequently calls `Blob.arrayBuffer()` and `Buffer.from(arrayBuffer)`. The latter creates a view rather than an additional byte copy. The cached Supabase client uses global Node fetch with a 30-second abort signal, without creating an Agent/dispatcher per request in application code. The download phase therefore includes network/TLS, full body consumption and Blob construction; response compression and connection/session allocation are not distinguished by these counters. Avoid naming one as the culprit without further evidence.

## Read-only SSH inspection, 11:06–11:08 UTC

The owner authorized a dedicated local SSH key and supplied the live service's Frankfurt SSH command. The server key was checked against the [official Render fingerprint](https://render.com/docs/ssh) before adding the matching public server key to local known_hosts; strict host checking remained enabled. No private key contents, full environment, customer paths, IP addresses or raw mappings were printed. No remote file, dependency, flag, debugger, process or allocator configuration was changed.

The real gateway is PID 6, running `deployment/container-start.mjs`, which imports the combined service after migrations. The backend PID 61 / kernel startTicks 308263523 exactly matches the stored diagnostics and backend boot `600077c4-21c8-4d90-9ec0-578bf203e5ca`; the shell reports final release `5b8d43e`. This is a running-service shell, not a new test instance.

| Process | smaps RSS | PSS | Anonymous | Threads | FDs | Socket FDs | TCP established | CLOSE_WAIT |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Gateway PID 6 | 95.13 MiB | 49.01 MiB | 33.49 MiB | 14 | 32 | 8 | 1 | 0 |
| Backend PID 61 | 133.40 MiB | 85.87 MiB | 62.16 MiB | 14 | 31 | 7 | 2 | 0 |
| Website PID 62 | 85.60 MiB | 43.28 MiB | 31.60 MiB | 11 | 36 | 2 | 0 | 0 |
| CRM PID 63 | 68.44 MiB | 28.61 MiB | 19.76 MiB | 11 | 32 | 2 | 0 | 0 |

Backend thread/FD/socket counts were unchanged between 11:06:36 and 11:08:31. Unix/IPC sockets and duplicate descriptors explain why socket-FD totals need not equal unique TCP rows. No connection backlog or CLOSE_WAIT accumulation is demonstrated by these two samples; that does not exclude a longer-term leak.

Numeric mapping aggregation for the backend found 15.50 MiB resident in the main `[heap]` mapping, 44.69 MiB in accessible anonymous mappings and 73.14 MiB file-backed RSS (25.61 MiB PSS). Another 11,490.79 MiB was inaccessible **virtual reservation with zero RSS**, not RAM usage and not a measurement of arena count or fragmentation. Mapping categories do not distinguish occupied malloc chunks from reusable/free chunks within a resident arena.

The SSH collector itself temporarily had 55.23 MiB RSS and finished its read-only collection in 34 ms. Cgroup readings while a collector/shell is active include that overhead; do not attribute them to the application. Linux process RSS and smaps RSS can differ due to accounting/sampling, so compare the same metric consistently. Neither sum of RSS nor sum of PSS is the measured cgroup charge.

The installed SDK is Supabase/storage-js 2.106.0; the production Node is 22.23.4 with glibc, no detected jemalloc and no configured MALLOC_ARENA_MAX. The SDK streaming API exists but returns only the body stream, losing headers needed by the current MIME/length validation; it is not a safe drop-in replacement without additional work and equivalence tests. The byte cache is bounded to 12 MiB, whereas the separate CRM signed-URL cache stores strings without a hard entry cap and expires entries on lookup. Its role and small observed JavaScript heap do not explain the full native/anonymous growth on their own.

These reads establish working access and add descriptor/socket/mapping evidence. They do not solve the previous multi-hour increase. If renewed growth occurs with stable heap, connection counts and bounded photo cache, a useful next discriminator is in-process allocator totals for non-free versus free/reserved chunks across all arenas. A separate Node helper's allocator statistics would describe the helper, not the backend. No native allocator probe has been deployed.

## Total-container growth from the final boot, through 11:11 UTC

The owner correctly observed total growth after restart. Backend stability over a short quiet interval is not total-container stability. Historical components are available, so the following uses actual cgroup samples rather than subtracting RSS totals:

| Time UTC | Cgroup current | Backend HTTP starts | Photo reads | Context |
| --- | ---: | ---: | ---: | --- |
| 10:38:05 | 138.73 MiB | 2 | 0 | Warm-up; first cooperative snapshots |
| 10:39:35 | 152.02 MiB | 4 | 0 | Before photo testing; two other requests / SSR startup |
| 10:44:35 | 170.60 MiB | 11 | 7 | Three controlled photo GETs plus four other master reads |
| 10:47:05 | 172.02 MiB | 11 | 7 | Before SSH inspection |
| 11:11:35 | 180.61 MiB | 13 | 7 | SSH collector commands have exited; two additional non-photo requests |

The total increase is 41.88 MiB, not a no-request interval. Cgroup anonymous memory rose 110.27 → 149.41 MiB (+39.14), file memory 17.15 → 18.57 (+1.42), and kernel memory 10.32 → 11.64 (+1.32). Slab, page-table and kernel-stack counters are kernel subcomponents, not additional independent quantities to sum.

Resident anonymous changes across the four application processes were gateway +7.76 MiB, backend +17.32, website +10.67 and CRM +1.29. Their combined change is approximately 37.04 MiB, leaving approximately 2.10 MiB of the anonymous cgroup change unassigned to these application-process measurements. Other processes, SSH/shell infrastructure and non-atomic accounting are possible contributions; an exact owner is not established by this difference.

V8 physical-heap changes were +2.42 / +2.88 / +4.63 / +0.43 MiB respectively. External memory was approximately unchanged in gateway and CRM, +2.12 MiB in backend and +0.13 in website. These observations explain part of the resident growth but are not an accounting equation for allocator occupancy or a proof that the remainder is leaked.

After the last SSH collector command, the 11:10:05 and 11:10:35 samples had cgroup usage 180.52 / 180.55 MiB, identical backend smaps RSS 133.43 MiB and anonymous memory 62.19 MiB, 14 backend threads, seven lifetime photo reads and zero active HTTP requests. This excludes assigning the whole +41.88 MiB to the transient collector, and does not establish a long-term plateau or explain the old boot's 125 MiB photo-associated increase.

## Additional instrumentation: allocator free versus non-free memory

Status at preparation: the owner authorized implementation and publication after the read-only SSH inspection. The C parser/addon, backend loader/provider, tests and Linux Docker compile/smoke gate are implemented. Local Windows validation covers JS behavior/typechecking, not glibc or the Linux binary. Deployment and valid production samples must be confirmed separately after publication. No live SSH installation or manual process intervention is used.

### Measurement and interpretation

Use an N-API addon **inside the existing backend process**, calling glibc `malloc_info(0, stream)`. The [documented interface](https://man7.org/linux/man-pages/man3/malloc_info.3.html) reports all allocator arenas and is MT-Safe. Another process's invocation would measure that other process and cannot answer the backend question.

Keep only global XML totals outside each `<heap>`; do not sum per-arena and global totals together. Return these eleven fixed numeric fields: `available`, `reasonCode`, `arenaCount`, `arenaSystemBytes`, `arenaFreeFastBytes`, `arenaFreeRestBytes`, `arenaNonFreeBytes`, `mmapBytes`, `mmapCount`, `xmlBytes`, `outputLimitBytes`. Non-free means system arena bytes minus reported fast/rest free bytes, not proven live application objects. Thread-local caches, allocator bookkeeping and observation skew limit that interpretation. The separate malloc mmap total excludes arbitrary direct mmap allocations by V8 or other libraries. These totals describe allocator memory, not resident pages; do not add them to RSS, V8 physical heap or external memory as independent quantities.

- Free/reserved arena bytes rising while non-free stays broadly level supports allocator retention/reuse/fragmentation as an explanation for resident growth. It does not identify the allocating library or guarantee pages are returnable.
- Non-free or malloc-mmap bytes rising persistently shifts attention toward retained allocations; it still does not prove a leak or identify their owner. Compare with photo cache capacity, V8/external metrics and request phases.
- RSS rising without corresponding allocator totals points toward direct mappings, another allocator, shared/file/kernel charge or missing coverage. Preserve unavailable/unsupported states rather than converting failure into zero usage.

### Bounds and failure behavior to implement and review

- Use a fixed 64 KiB scratch buffer with `fmemopen`, no file or unbounded `open_memstream`. Keep only parsed numbers; never persist XML, addresses, paths or allocation contents. Reject truncation, unknown format, missing/duplicate totals, invalid arithmetic and non-finite/unsafe numbers.
- Register one provider in the backend's existing snapshot flow (six of eight provider slots). Cache the sample for at least 30 seconds, including during upload-phase diagnostics; no new timer, per-photo sample, event queue or background worker.
- Existing `RUNTIME_DIAGNOSTICS=false` must avoid loading the addon. Unsupported platform, missing binary, other detected allocator, native failure, parsing failure or output cap must produce an explicit numeric unavailable/reason state and leave the application working.
- The JS wrapper allow-lists and validates fields, reports sample age/count and last/max probe duration, and avoids repeating a probe that exceeds 25 ms until process restart. The first valid result is retained during its 30-second cache window; subsequent snapshots mark it unavailable/reason7 once the circuit is open. This does **not** hard-timeout the first synchronous native call. `malloc_info` takes allocator locks and can pause the backend; measure that cost and state it honestly. No `malloc_trim`, GC, allocator tuning or process attachment is used.
- Sampling itself adds a fixed scratch area, small stdio/N-API bookkeeping and one temporary result object. Its observed baseline and probe cost must be considered; it is not a zero-cost observer.

### Files/build/test viability before any publication

The native files are `allocator_parser.h`, `allocator_snapshot.c` and `allocator_parser_test.c`. The backend registers `allocatorDiagnostics.ts`; Docker compiles against stable [Node-API](https://nodejs.org/api/n-api.html) version 8 and runs the parser plus `check-native-allocator.mjs` against the emitted JS and real addon. No new npm dependency is used. `gcc` and libc development headers are installed **only in the Linux Docker build stage**; the existing Node headers supply N-API. Only the small `.node` output passes through the existing backend-dist copy into runtime. No compiler/Docker/WSL is installed on the user's Windows computer or live server.

Checks: C parser fixtures cover multiple arenas without double-counting, malformed/truncated/duplicate/overflow output; compilation treats warnings as errors. The Linux build smoke loads the actual binary, requires valid arithmetic and a probe within 25 ms, and exercises provider serialization without credentials or application imports. Fifteen JS tests cover disabled/no-load, 30-second cache, missing/unsupported/alternate/invalid/failing probe, finite numeric shape, circuit behavior and real diagnostic sanitization. They pass locally with backend typecheck; four existing photo-diagnostic tests also pass. Windows tests cannot validate glibc or claim the native binary works. A Linux compile/smoke failure stops deployment instead of silently shipping a broken probe.

Activation requires **the authorized new code deployment**, replacing the application instance and therefore starting a new memory baseline. The existing diagnostic flag is already on; no flag or allocator tuning is changed. Preserve current evidence before that reset. This commit does not fix the RAM issue or establish whether it is fragmentation versus retained allocations.

Provider fields are the eleven native fields above plus `sampleAgeMs`, `samples`, `probeMs`, `probeMaxMs`, `circuitOpen`. Reason codes: 0 valid, 1 unsupported platform/libc, 2 binary missing/unloadable, 3 native call/I/O failure, 4 XML cap, 5 XML format, 6 invalid binding/data, 7 slow circuit, 8 diagnostics off, 9 known preloaded alternate allocator. Missing/unsupported data is not zero usage. The alternate-allocator guard checks known names in LD_PRELOAD; direct/private allocators remain outside this glibc-only view. Native XML is never returned. `arenaNonFreeBytes` is deliberately not called live allocated bytes; the [glibc implementation](https://codebrowser.dev/glibc/glibc/malloc/malloc.c.html) counts arena bins/top chunks rather than an application-object ownership graph, and tcache/bookkeeping limit interpretation.

## Resume after about five hours of normal demand

This is a continuation checklist, not a scheduled automation. No reminder or recurring task was created here.

1. Read the stored snapshots covering the intervening period, including cgroup components and each process's heap, V8 physical heap, external/ArrayBuffers, smaps RSS/PSS/anonymous memory, HTTP active/completed counters and `photoreads` phase increments. Paginate if needed; do not silently truncate to the first hour.
2. Verify release, instance and process boot/startTicks first. The historical reference before allocator instrumentation was release `5b8d43e`, instance `94c904f3-b7c2-41c6-a7b5-52b2255407c4`, gateway PID 6, backend PID 61 / startTicks 308263523 / boot `600077c4-21c8-4d90-9ec0-578bf203e5ca`. A new boot requires separate comparisons.
3. Use existing natural demand before considering further loads. Baseline 11:11:35 had cgroup 180.61 MiB, backend smaps RSS 133.43 / anonymous 62.19 / V8 physical 27.62 / external 5.83 MiB, seven photo reads and zero active HTTP. The controlled three-photo sequence has ended.
4. If another SSH snapshot adds information, use the owner-provided live-service connection with the verified Frankfurt host key and dedicated local key, then the read-only `backend/scripts/runtime-process-inspection.mjs` via stdin, passing the newly verified gateway PID. Do not upload the script or print private key/environment contents. Compare FD/socket/TCP states and mapping categories against the 11:08 snapshot; read telemetry before and after the short helper to separate its memory cost.
5. Report which process and which cgroup component changed, alongside actual activity and phase deltas/overlap. An interval with no new HTTP starts can still contain earlier in-flight work. Absence of human interaction is not absence of requests.
6. If anonymous resident memory rises again while queues/FDs/threads remain bounded, compare valid allocator system/free/non-free/mmap increments alongside V8/external metrics. These are allocator estimates rather than application-object ownership. Check availability, age and circuit status before interpreting them. Do not infer a fixed leak rate, promise stability or restart to make the graph look better.

## Authorized mitigation: runtime arena limit

The additional instrumentation was deployed in `76167db`. On the same backend boot, 11:28–19:22 UTC, allocator system arenas rose about 17.086 → 123.461 MiB (+106.375), reported free bytes 10.103 → 110.005 MiB (+99.901), and non-free bytes 6.983 → 13.456 MiB (+6.474); malloc-mmap stayed 1.594 MiB. Roughly 94% of arena growth was reported free. This supports allocator retention/reuse as the dominant observed arena growth, not a demonstrated application-object leak or proof that all free bytes are resident/returnable. The 19:22 sample had 17 arenas and zero OOM events.

Following the owner's explicit approval, this isolated change sets `MALLOC_ARENA_MAX=2` in the Docker **runtime stage only**. No allocator replacement, library, GC/trim intervention, cron, Sharp thread setting, image recipe, auth or data schema is changed. The [glibc arena limit](https://sourceware.org/glibc/manual/latest/html_node/Memory-Allocation-Tunables.html) constrains arena count, not bytes per arena; existing arenas are not emptied. A planned deployment creates a new baseline. Fewer arenas can increase lock contention/CPU/latency, and two arenas can still retain significant memory.

The supervisor forwards runtime environment to the backend, website and CRM; the existing codec-worker allow-list also forwards this variable. Each process has its own limit. Builder/compiler and native build-smoke settings are unchanged. A Render environment override could supersede Docker ENV, so source configuration alone is not activation evidence.

Activation checks: new release/boot, healthy public service, `native.mallocArenaMaxConfigured=2`, repeated backend `native.allocator.available=1`/reason0/circuit0 and `arenaCount<=2`. Compare post-warm-up allocator system/free/non-free/mmap growth and cgroup memory under similar natural request/photo activity, with CPU and HTTP durations/errors. A low initial RSS after deployment is not success evidence. No routine stress or artificial cache resets are needed.

If retention does not improve materially or contention causes a regression, revert **only this isolated runtime-limit commit** and redeploy, preserving later work, diagnostics and data. No DB rollback is involved. Jemalloc remains a separate possible next change, recommended by [Sharp for Linux/glibc](https://sharp.pixelplumbing.com/install/#linux-memory-allocator); it would require different allocator-stat coverage rather than interpreting unavailable glibc statistics as zero.

## Follow-up: remove a temporary WebP body copy

Read-only inspection through 20:44:59 UTC confirmed the same A3 backend boot and two valid arenas throughout 141 snapshots. Since 19:55:29, 29 HTTP requests included 22 photo-body reads (19 derivatives, including nine warmups, and three masters), plus ten manifest-sidecar downloads. Backend smaps RSS rose 125.070 → 157.426 MiB; cgroup memory rose 137.934 → 181.316 MiB. Arena system bytes rose 19.535 → 65.246 MiB, with reported free bytes accounting for about 86% of that increase. No 5xx or OOM occurred. The final 4.5 minutes had no new requests/reads and no backend RSS or arena-system growth. This is photo-associated retained allocator reserve, not proof of a continuing idle leak, allocator replacement requirement, or a specific allocating library.

The WebP metadata filter previously concatenated all retained chunks into a full temporary body, then copied that body into the final RIFF. It now concatenates the header and retained chunks directly into the final buffer. Parsing, rejection rules, chunk padding, ICC, orientation and JPEG/PNG paths are unchanged. The change removes one full-body allocation/copy per WebP sanitization; it does not change encoded pixels, compression, Storage masters, cache policy or metadata privacy filtering.

Five synthetic local fixtures preserve exact pre-change input/output bytes, including alpha, ICC, orientations 6/8, simple VP8 and nonzero odd-chunk padding. Regression tests cover byte equality, decoded pixels, input immutability, recorded truncation boundaries, malformed RIFF/chunk sizes and animation rejection. The 69 focused metadata/optimization/variant/cache/read-diagnostic tests and backend typecheck passed. A local Windows accounting run on a 705,832-byte sanitized WebP measured two → one `Buffer.concat` calls and 1,411,652 → 705,832 concatenated output bytes, saving a 705,820-byte temporary body with identical output SHA-256. This is exact JS copy accounting, not a Linux RSS, allocator or latency benchmark; it cannot explain the entire 45.7 MiB arena increase or establish production efficacy. Preserve A3 as a separate baseline and verify the new release/boot and arena cap after deployment before comparing subsequent natural traffic.

## Follow-up: request the browser's actual detail width

Release `75a0f0d` activated at 20:53 UTC with the arena limit intact and healthy public service. Its stored baseline through 21:00:06 had no photo reads, so it cannot establish a post-copy-change improvement under photo traffic.

The public detail JSON route no longer starts up to nine speculative 320px downloads. Browser navigation already prepares every approved photo using the actual detail slot, density and current photo identities; direct gallery entry retains its existing eager/native image path. Pixel quality, widths, authorization, byte-cache TTL/capacity and Storage are unchanged. This avoids the extra 320px work when the browser needs another width; it does not suppress the browser's nine genuine image requests or guarantee lower first-photo latency at 320px/DPR1.

Validation: 100 public API tests, including zero Storage downloads for detail JSON and fresh revocation checks; 24 client photo/session tests; and an isolated headless browser with synthetic local images. Profiles 320/DPR1, 390/DPR2 and 1440/DPR1 each prepared nine distinct versioned photos exactly once at 320, 800 and 1280px respectively. Browser network requests were limited to local test responses. No production photo load was generated for this comparison.
