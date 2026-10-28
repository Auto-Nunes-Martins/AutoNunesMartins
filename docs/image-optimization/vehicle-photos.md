# Vehicle photographs and permanent homepage composition

The fifth homepage composition is permanent. The selector and retired hero implementations
were removed. The shared contact ending uses the same forest image and palette on all
pages rendered by DesignEdition. Existing source artwork remains available for future
derivatives; production imports only the chosen composition.

## Vehicle delivery

Current membership rule: every current vehicle photo follows global publication, without individual exclusions. See [the official publication rule](../vehicle-photo-publication.md). Public delivery remains fixed at 1600 px under the [single-photo delivery experiment](../photo-delivery-experiment.md); the widths below remain supported by the backend and CRM.

- Supported derivative requests are shared through `@anm/types/photoWidths`:
  320, 384, 800, 1280, 1600 and 2560 CSS source-width descriptors.
- 384 accommodates a 112 CSS-pixel thumbnail on a DPR-3 display without jumping to 800.
  1280 accommodates typical mobile cards and featured photographs at high density.
- WebP derivatives use quality 84, effort 6 and smart subsampling. Earlier recipes
  used quality 94/effort 3 and quality 90/effort 6. Upload admission and master policy are retained;
  new passthrough uploads and public original/zoom responses now remove private metadata
  without re-encoding pixels. Live authorization and private/no-cache policies remain.
- Derivatives are generated directly from each stored master, never from another derivative.
  No image is enlarged. Requests above the master's available derivatives retain the
  original fallback, so a requested width is not a promise that a small master has that width.
- The manifest schema and namespace stay compatible. `encodingVersion: 3` distinguishes
  this recipe, so a complete old manifest is regenerated rather than incorrectly reused.
  Derivative uploads finish before the manifest is published. Masters and vehicle rows
  are never replaced by the backfill.

On 23 October 2026 the configured private storage was updated: 44 masters produced 208
derivatives, with zero failures/skips. Every master was checked before/after and vehicle
state remained unchanged. Detailed reports are local, under
`artifacts/vehicle-photo-compression/`, and are not deployment assets.

## Measurements and visual review

The current version-3 review on 25 October used the actual private inventory and
updated all 51 associated photos / 233 derivatives: 31,864,450 → 23,756,646 bytes
(25.4% less). Ten representative sources, native detail crops, quality comparisons
and 24 local browser comparisons informed the choice. Existing masters and database
state were verified unchanged. New CRM uploads use the same backend derivative recipe;
the browser does not compress uploads. See the [complete report](../vehicle-photo-compression-2026-10-25.md).

The measurements below preserve the earlier version-2 comparison for historical context.

Six public vehicle cover photographs were used for comparisons. The audit renders
normal display sizes and original-pixel crops of headlights, grilles, paint and tyres.
The chosen recipe showed no material visible deterioration in these comparisons.
This is a visual assessment, not a claim of mathematically lossless compression.

Actual mean bytes served locally after regeneration:

| Requested width | Previous sample | New sample |
| --------------- | --------------: | ---------: |
| 320             |          25,991 |     20,135 |
| 800             |         146,595 |    110,655 |
| 1600            |         500,611 |    373,722 |

The new 384 version averaged 27,781 bytes; the new 1280 version averaged 255,994 bytes.
When these are appropriate for the display density, they avoid the previous jumps to
800 and 1600 respectively. These sample savings are not guarantees for every photograph.

## Homepage backgrounds

`scripts/optimize-home-v5-images.mjs` uses per-asset settings: forest AVIF 55/WebP 88,
catalogue AVIF 45/WebP 85, curves AVIF 65/WebP 88, service AVIF 60/WebP 85;
remaining assets default to AVIF 70/WebP 90. AVIF effort is 5, with 4:2:0 for forest/catalogue
and 4:4:4 otherwise; WebP effort is 6 with smart subsampling. Crops, focus points and CSS
colour treatment are preserved. It covers the
hero, discovery card, services, editorial pause and contact ending. The approved service
photograph is now served locally, retaining its existing position and grayscale treatment.

The forest portrait set additionally contains 1440, 1600 and 1792px candidates. These
decorative assets are a separate pipeline and do not extend the vehicle-photo width allowlist.
See [mobile measurements](../mobile-homepage-performance.md) and the current
[vehicle-photo policy](../photo-variants.md).

`coverImageSizes` measures the required object-fit cover width, including tall portrait
crops. It leaves device pixel density to the browser. Lazy backgrounds receive their
actual required size before scrolling into view. Listeners and observers are removed
on unmount. Conservative SSR estimates remain available before hydration.

At equal resolution, the largest AVIF portrait derivatives reduced the original hero,
discovery and editorial source bytes by approximately 22%, 20% and 28%. The contact
wide image fell from 940,392 to 589,923 bytes. The service image at 1920 fell from
797,182 bytes (previous CDN JPEG response) to 335,049 bytes (local AVIF).
Resolution selection can provide additional savings. Compression alone does not reduce
decoded pixel memory at the same dimensions, and this work does not establish the cause
or resolution of the previously reported browser crashes.

## Reproducing the comparisons

From the repository root, using the installed dependencies:

```powershell
node scripts/audit-vehicle-photo-compression.mjs --download
node scripts/optimize-home-v5-images.mjs --download
node scripts/compare-home-v5-images.mjs
```

The first script caches read-only public vehicle samples locally. The background script
preserves all source files and creates additional deployment assets plus a generated
import module. `--module-only` rebuilds that import module from the local measurements.

The storage migration defaults to inspection. With the backend's existing private
environment, run from `backend/`:

```powershell
node --env-file=.env --import tsx scripts/backfill-photo-variants.ts --report ../artifacts/vehicle-photo-compression/backfill-inspect.json
node --env-file=.env --import tsx scripts/backfill-photo-variants.ts --apply --report ../artifacts/vehicle-photo-compression/backfill-applied.json
```

The apply operation is idempotent for the current encoding version. Do not commit
credentials, downloaded masters or temporary comparisons with the implementation.
