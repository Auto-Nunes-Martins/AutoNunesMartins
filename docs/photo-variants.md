# Vehicle photo variants

The master photo identity, order, principal photo and explicit publication permissions are unchanged. Existing stored masters are never overwritten by generation or backfill. New uploads keep the existing admission/optimization policy; variants are created from that stored master before attachment/save succeeds. Failure leaves an unassociated private upload that the same upload ID can retry.

## Sizes and quality

The shared widths are **320, 800, 1600 and 2560 px**, preserving aspect ratio, auto-orienting EXIF and stripping EXIF/location metadata. Only sizes smaller than the native oriented width are generated. WebP quality 94, effort 3 and smart chroma subsampling favor detail over an arbitrary byte target. Sources and lightboxes retain their originals. Responsive `srcset`/`sizes` select candidates for display size and device pixel ratio; CRM source sets include the native original as the largest candidate.

Thumbnails/lists/pickers share small variants. Cards, comparison, homepage/dashboard highlights, detail images and photo bands share larger ones. Local draft `blob:` previews need no server generation. Curated editorial/facade assets use their existing separate asset pipeline.

Derivatives live at `<vehicleId>/.variants/v1/<masterFilename>/<width>.webp` in the **same private bucket**. They cannot be submitted as master paths or independently approved for publication. The final `manifest.webp` is a valid 1×1 WebP containing only a generated XMP/base64 manifest (dimensions, content hash and available variants). This sidecar respects the bucket's raster-only MIME restriction; it carries no source EXIF or credentials. The manifest is written last so interrupted runs can resume. Changing encoding settings or mutable-source semantics requires a new version namespace.

## Delivery and authorization

Public photo URLs remain `/viaturas/<slug>/photos/<index>`; `?w=320|800|1600|2560` selects a derivative. Every request and conditional 304 first resolves the current published vehicle, ordered approved photo and valid owned master path. Reordering changes the resolved source/ETag; unpublishing, selling or withdrawing approval blocks subsequent reads. Originals remain `no-store`. Variant responses are **private, no-cache, max-age=0, must-revalidate**, with content/source-specific ETags. No public signed Storage URL is exposed.

The backend caches only pixel buffers, never publication approval. The combined retained-pixel budget is 12 MiB: 4 MiB reserved for small derivatives (up to 800px/512 KiB, ten-minute TTL), and 8 MiB for other eligible responses (one-minute TTL, entries ≤2 MB). Both pools use bounded LRU eviction. The detail query may warm the first nine base thumbnails with two process-wide workers; later image requests always recheck authorization. See [delivery diagnostics](photo-delivery-performance.md) for preparation and validation details. The private variant manifest cache is bounded to 500 entries; positive manifests live forty minutes and missing manifests retry after five seconds (one minute for a confirmed 404). No image encoding occurs on public read requests.

Photo and identity requests for the same slug/database client share only an authorization lookup that is still running. Its result, denial or failure is discarded as soon as the query settles, before pixel download completes. A later wave or gallery opening performs a new lookup; this is not an authorization TTL or a guarantee of one query per gallery.

CRM authenticated reads use private signed URLs under the existing one-hour expiry policy. Variant selection does not make private photos public. Already issued signed URLs remain valid until expiry; browser downloads/screenshots cannot be remotely erased. Public revalidation prevents a cached public variant from bypassing current authorization, but cannot erase bytes already delivered. Explicit photo deletion also removes known derivative objects and invalidates local caches. Backfill performs no deletions.

## Revisiting a public photo gallery

The thumbnail action retains exact previously downloaded 320/800px bodies in a bounded **in-memory** pixel cache (up to 4 MiB/120 records, ten minutes), for the current document only. It stores no approval and adds no persistent browser store. Each mounted gallery obtains one fresh no-store authorization snapshot from /viaturas/<slug>/photos/access. Opaque identities represent the current ordered, explicitly approved immutable master paths. Cached pixels are attached only when that snapshot matches their identity and their resolution covers the display size/DPR. Reordering, withdrawing approval and unpublishing cannot reveal an old cached photo at its former index.

Warm client navigation avoids starting a conditional HTTP request per retained thumbnail. First visits and **full document reloads retain native protected HTTP delivery**, including revalidation, and may still show progressive loading. No rail-wide hide/fade or wait-for-the-last-image transition is used. Storage, originals and HTTP authorization policy are unchanged. Already delivered pixels cannot be remotely erased; they confer no authority on later visits.

## Backfill

Script: `backend/scripts/backfill-photo-variants.ts`. Run from the repository root with Node, installed dependencies, and the backend environment file:

```powershell
node --env-file=backend/.env --import tsx backend/scripts/backfill-photo-variants.ts --apply --report .cache/photo-variants-backfill.json
```

Without `--apply`, it only verifies the private bucket and inventories eligible paths. With `--apply`, it checks the vehicle-owned master path and private derivative destination before writing, processes **one photo at a time**, uses Sharp concurrency 1/cache disabled, limits input to 20 MiB/24 megapixels, and bounds each encoding to 20 seconds. Run during a quiet period on a 0.5 CPU/512 MB instance; do not run multiple backfills alongside heavy uploads. Logs contain hashed photo identifiers and sanitized stages, never Storage tokens or environment secrets.

It verifies the master bytes after each completed photo and compares the vehicle photo/publication state before/after. No Prisma writes or migrations occur. The report is updated atomically after each photo. A completed manifest plus existing objects makes reruns idempotent; partial derivatives can be safely regenerated. Failed/skipped items or concurrent vehicle-state changes produce a nonzero exit code. SIGINT/SIGTERM finishes the current photo and stops between photos; rerun the same command to resume.

Tests cover EXIF orientation, small sources/no upscaling, immutable masters, missing variants, interrupted generation, persisted-sidecar reads, reuse, live authorization and conditional requests after revocation. Visual checks compare originals resized to the same dimensions with encoded variants; they do not claim pixel-identical lossy compression or guaranteed production timings.
