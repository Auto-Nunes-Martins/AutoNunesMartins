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

## Prepared local observability patch

Not deployed. Production already has `RUNTIME_DIAGNOSTICS=true`; after a reviewed deployment, the new `native.photoreads` provider will join the existing application snapshots. It adds no timer, event per photo, queue, URL/ID map, database migration or new flag. Disabled diagnostics do not sample memory or clocks.

Fixed numeric counters distinguish byte-cache hit/miss, pending-read deduplication, manifest hit/miss/deduplication, fallback and background warming. Seven fixed phases separate manifest/derivative/master Storage downloads, Blob-to-Buffer materialization, manifest metadata, derivative metadata validation and master sanitization. Manifest helpers are shared with maintenance/upload code; their counts are not exclusively public HTTP requests.

Each phase records started/completed/failed/active/peak counts, duration and observed process-wide RSS/heap/external differences. Completed includes failures. Differences can include concurrent work and delayed collection; do not sum overlapping phase deltas as attributed allocation. `overlappedSamples` marks overlap with another measured phase, not exclusivity from HTTP, Prisma or other runtime work. `masterSanitize` includes both metadata and JavaScript filtering. Failed counts are rejected/thrown operations; a Storage SDK result containing an error is still a fulfilled operation.

Counters are lifetime aggregates for one process boot, with finite saturation and fixed structure. Compare increments between snapshots with identical PID/boot; there is no reset timer. Nested phase metrics fit the existing sanitizer depth and 64 KiB payload limit, verified through the real provider and sanitizer in tests.

The provider has 105 numeric fields: 14 counters and seven phases with 13 metrics each. Its JSON is 1,974 bytes initially and 3,549 bytes with every number at `Number.MAX_SAFE_INTEGER`; that saturated structure also survives sanitization unchanged. The fixed numeric shape stays conservatively below 8 KiB. Backend registration uses five of the eight available provider slots (the existing persistence registrations replace the same named slot). A typical cold thumbnail has three measured phases / six `process.memoryUsage()` and six clock calls; a byte-cache hit has no memory/clock sampling. Disabled mode retains only flag checks and small async wrappers around the existing operations. No per-photo smaps, `/proc` inventory or filesystem inspection is added.

Validation: 39 focused tests passed (provider, reusable variants, delivery metadata), plus backend typecheck. Tests cover opt-out overhead, bounded serialized structure, signed deltas, overlap/errors/finally, cache hits avoiding Sharp, deduplicated cold reads and background warming. Production attribution requires this patch to be reviewed and deployed; no causal fix to image delivery has been claimed.
