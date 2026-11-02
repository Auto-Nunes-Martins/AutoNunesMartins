# Disposable photo codec process

> Estado em 02/11/2026: documento histórico. A telemetria temporária detalhada, os endpoints de diagnóstico e os scripts associados foram removidos no código local; a publicação desta remoção está pendente. Em produção, os registos de diagnóstico foram apagados e o writer SQL ficou compatível mas sem persistência. Os comandos antigos de diagnóstico não se aplicam ao novo código. Mantêm-se as otimizações funcionais, os limites de segurança e uma medição leve de memória por minuto no supervisor.

The 31 October production evidence showed ten completed uploads, low JavaScript heap, disabled Sharp cache, and high anonymous memory remaining in the backend. The recovered tenth-photo pair rose from 372.76 to 393.99 MB RSS, with only 0.53 MB additional heap; its first observed RSS maximum was during derivative encoding. This motivates process isolation, but does not prove allocator fragmentation or a particular native leak.

## Retirement rollout — 2 November 2026

The owner authorized removing temporary instrumentation and diagnostic data. Only `public.RuntimeDiagnosticEvent` and `public.append_runtime_diagnostics(jsonb)` were affected in production. On the configured project `vtnizfmiiqkmlbvbfohx`, the configuration agrees across PostgreSQL/Storage and all 21 public catalogue slugs and cover hashes matched. The supplied dashboard did not expose a project reference; it cannot independently establish identity.

The live change preserved the function signature/ACL, replaced its body with `RETURN 0`, and truncated only the diagnostic table under its existing advisory lock. It removed 7,375 events; the measured database size fell from 57,644,723 to 17,249,971 bytes. No business tables, photographs or Storage objects were removed. The table and owned indexes/sequence remain temporarily so the still-running old release cannot fail on missing SQL objects. The new code has no diagnostic writers or endpoints and keeps only a minute-level console heartbeat, without database persistence.

Deployment is not authorized by this work. For a future authorized release:

1. Apply the normal forward migration `20261102043000_retire_runtime_diagnostics` through the existing deployment flow. It records the compatible retirement in migration history; the live operational change already has the same effect. Existing migration files remain unchanged.
2. Roll out the telemetry-free runtime, then confirm that every old service instance, replica, background writer and manual diagnostic job has stopped. An empty table alone does not prove that callers have stopped.
3. Only afterwards promote `backend/prisma/deferred-migrations/20261102043100_drop_runtime_diagnostics/migration.sql` into the normal migration history for a subsequent release. It drops the exact function and table with RESTRICT, including only the table's owned indexes/sequence. It is deliberately outside startup migrations because those execute before a new release starts and an older release may still be serving.

The local preservation inventory and production before/after metadata are in `artifacts/telemetry-removal-2026-11-02/`. They contain source/metadata, never environment secrets or copied diagnostic payloads. Do not clean them or other local worktrees/dependencies automatically.

## Processing and lifetime

Production photo uploads now create one disposable codec process after the existing global admission and body limit. The same process optimizes the master and generates the derivatives and metadata sidecar. The API retains authentication, database and Storage operations. The child receives bounded compressed bytes over private IPC, with a small environment allowlist and no application/database/Storage credentials; its fetch API is disabled. This is process separation, not an OS filesystem/network security sandbox.

The derivative encoder was extracted without changing its recipe: widths, WebP84/effort6/smartSubsample, orientation, metadata filtering, integrity decoding and immutable Storage paths remain the same. The parent can ask the child to generate derivatives from an existing immutable master on a retry. Complete existing manifests continue to be reused. No raw decoded pixels cross IPC.

The API stops the child immediately after derivative generation, before uploading the derivative buffers, and waits for actual process closure. All error/disconnect paths also close it. The admission lock remains held until closure; a second upload is rejected rather than queued with its body in memory. Lost IPC/parent disconnect terminates the child. The API does not fall back to inline heavy processing after a child failure.

## Resource limits and observation

- Input: existing 20 MiB/24 MP limit; master: existing 2,000,000-byte cap.
- Derivative IPC result: at most 16 MiB including the small sidecar, with validated manifest, widths and byte lengths.
- One command in flight, at most two codec jobs per child; Node heap cap 96 MiB. This does not cap native codec allocations.
- Optimization deadline 55 s, derivatives 125 s, child lifetime 180 s; normal close has a one-second forced-kill fallback.
- On Linux, a bounded cgroup check every 100 ms stops the child when observed effective headroom falls below 16 MiB. The child attempts to increase its own OOM score so it is preferred over the API under pressure. Neither measure guarantees that an allocation burst cannot hit the container limit; availability and outcomes are recorded.
- Child memory/CPU sampled every 100 ms, including the kernel's process peak RSS; telemetry records PID, exit/exit signal, confirmed closure, lifetime, exit wait, guard/timeout and credential absence. The backend's `native.codec` provider reports session counts and whether production isolation is enabled.

Compare **cgroup usage/peak** for total container cost, parent backend RSS before/after, worker peak RSS, duration, output size, status and confirmed `workerExited`. Do not add worker RSS to cgroup usage, or interpret the parent's lower RSS alone as a lower total peak. Peak sampling can miss brief container spikes. Parent/worker heap and external categories overlap with RSS.

Production defaults to isolation. `PHOTO_PROCESSING_MODE=inline` is an explicit operational rollback; it restores the old processing path and can restore its retention behavior. Development/tests keep the old route mode unless a test explicitly selects production. No Render environment settings are changed by this implementation.

## Validation and controlled production test

Automated isolated checks compare exact master/derivative/sidecar bytes with the previous recipe, including a photographic JPEG and EXIF rotation. They cover invalid/oversized input, overlapping commands, cancellation, simulated cgroup pressure, real process exit and the production route with fake DB/Storage. A compiled-JavaScript smoke check verifies the runtime entrypoint without a development loader. These checks do not reproduce the Linux production allocator, the 512 MiB container quota, or claim a production RAM fix.

After the new runtime is confirmed through database diagnostics, the owner should send **one photo from the previous set**, not another ten-photo batch. Inspect the resulting backend upload event and following idle samples: success, output/quality, latency, child exit, total peak/headroom, parent RSS and child peak. Proceed to a batch only after that result is reviewed. A deploy restarts the container; its low initial memory is not evidence that photo retention is fixed.

## First production canary — 31 October

The owner added one photo to the existing ten-photo vehicle on release `b2c332b`. Backend upload completed at 05:22:41 UTC with HTTP 201 in 8.53 s. Input was 3,300,409 bytes/2788×1830; master output 1,002,216 bytes/2560×1680 with five derivatives. This differs from the previously recovered tenth photo, so their durations are not a controlled same-image performance comparison.

One codec session was created and closed, with no active sessions afterward. Its exit was normal (code 0), closure took about 24 ms, and no credentials were present. OOM priority adjustment reported unavailable; cgroup counters showed no OOM/kill or limit hits. No memory-guard failure was reported.

Container usage was 195,575,808 bytes in the last pre-upload global sample, reached a kernel cgroup peak of 339,398,656, then was 209,203,200 immediately afterward and 209,973,248 in the next sample. Backend RSS was 159,764,480 at upload start, 168,546,304 at finish and 170,774,528 in both following global samples. Parent memory did not return exactly to its pre-upload value. These results confirm child execution/exit and substantial release after the transient peak, but not the absence of cumulative retention across a batch.

The authoritative codec-provider peak for the only worker was 186,245,120 bytes. The per-upload worker-memory field still used the old 100,000,000 numeric-metadata cap and retained an earlier smaller observation; it must not be reported as the true worker peak. A bounded worker-memory-specific filter correction and regression test were prepared afterward. Client-supplied headers cannot set worker observations. Keep the same production instance for the next comparison rather than deploying this telemetry-only follow-up between photos.

The owner then sent three further photos on the same instance, completing at 05:28:34, 05:28:37 and 05:28:40 UTC. All three returned 201, in 3.27/2.82/3.01 seconds. They were smaller inputs (833×962 and two 1024×768 images), so they do not establish worst-case performance for large photos. Each had a distinct codec PID, normal exit and confirmed closure. The provider reported four created/four closed/zero active sessions, with no upload failures or cgroup OOM events.

Backend RSS start/end pairs were 179032064→179163136, 179294208→179425280 and 179425280→179556352 bytes: +131072 bytes during each operation. The last pre-batch global sample was 218578944 bytes container/179032064 backend RSS; the first post-batch sample was 226144256/182439936. Sampled container peaks per upload were 275435520, 267620352 and 269246464 bytes; the kernel lifetime peak remained the first photo's 339398656. This small batch did not show the previous large per-photo increase in the API, but retained memory is not zero and four photos are not a proof of stability for every input or long-term traffic.
