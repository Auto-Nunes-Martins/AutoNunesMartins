# Disposable photo codec process

The 31 October production evidence showed ten completed uploads, low JavaScript heap, disabled Sharp cache, and high anonymous memory remaining in the backend. The recovered tenth-photo pair rose from 372.76 to 393.99 MB RSS, with only 0.53 MB additional heap; its first observed RSS maximum was during derivative encoding. This motivates process isolation, but does not prove allocator fragmentation or a particular native leak.

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
