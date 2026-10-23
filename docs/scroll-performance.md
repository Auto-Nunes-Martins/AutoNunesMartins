# Scroll measurements and navigation

The production desktop trace received on 23 October 2026 lasted 25.89 seconds and
covered home → catalogue → company. It contained 14.10 seconds of UpdateLayoutTree
events, of which 9.88 seconds (1,230 events) had a stack pointing to the scrollHeight
read at the end of designMotion.draw. These nested durations must not be added to
the parent FunctionCall/RunTask durations. This is a profiling baseline, not proof
of the reported iPhone crash or of a JavaScript memory leak.

## Implementation

- designMotion captures scroll position, viewport, document height and scene
  geometry before writing CSS variables. It skips unchanged inline values without
  changing the interpolation, thresholds, effects or timings.
- scrollFrame batches the animation, compact navigation, hybrid navigation and
  catalogue sidebar actions. All queued reads finish before any queued writes.
  Requests coalesce; settling work is deferred to the next frame. Cancellation
  removes queued work and invalidates writes already prepared for a removed action.
  Initialization/restoration has an explicit synchronous path to preserve the
  first paint and restored scroll position; it is not the continuous scroll path.
- Navigation determines header geometry before changing compact/hidden classes.
  Inactive compact navigation does not read geometry.
- Catalogue filters do not measure geometry or queue directional scroll work at
  widths up to 800px, where their desktop positioning is inactive. Resizing still
  resets or recomputes the state. Desktop short panels retain native sticky;
  tall panels retain their directional bounds and pixel positioning.

This change does not simplify mobile effects. Existing separate mobile CSS edits
(ambient featured-card glow and home-card spacing) remain independent.

## Verification

Automated tests cover shared read/write ordering, coalescing, settling,
cancellation between read and write, cancellation isolation, unchanged CSS values,
the real motion/navigation actions' geometry ordering, mobile menu visibility and
scroll direction, and skipping mobile/inactive geometry. Existing scroll timing
and catalogue position tests retain their original expectations.

Local production build checks include home → catalogue → company → home,
desktop sidebar positioning, mobile direction changes, opening the menu and
absence of captured runtime errors. Browser viewport testing is not a real iPhone
test.

## Measuring improvement

Record the same path again on the updated build in Chrome with equivalent viewport,
device scale, extensions, cache and recording settings. Compare UpdateLayoutTree
time/count, main-thread tasks over 50ms and the geometry initiator stacks. Compare
memory at equivalent page/GC states; use repeated round trips or heap snapshots
if retention remains a concern. Do not state a measured percentage improvement or
that the iPhone crash is fixed before that evidence exists.

## Follow-up: remaining geometry readers

The second desktop capture lasted 27.06 seconds and included a homepage reload.
The recalc stack associated with designMotion's document-height read fell from
9.88 seconds to about 0.172 seconds. Total style recalc remained 12.63 seconds;
the captures have different starting conditions, so this is not an overall page
speed percentage or proof that the crash is resolved.

The follow-up keeps all visual CSS, interpolation, thresholds and transition
durations unchanged:

- WhatsAppContact uses IntersectionObserver's supplied stats bounds at the same
  bottom <= 0 crossing. It does not synchronously measure on scroll. Navigation,
  DOM changes and viewport changes refresh the observer; leaving home detaches it.
- NotificationHost schedules header geometry only while notices or outgoing
  transition cards exist. Reads share scrollFrame with the motion actions, and
  unchanged placement/visible-count values are not rewritten.
- OrbitPerspective delegates its existing calculations to perspectiveMotion.
  All geometry is captured in the shared read phase; the existing light and line
  formulas run with those captured values. Unchanged CSS variables are skipped.

Tests cover the WhatsApp crossing and resize/history refresh, idle notification
geometry, cross-component read/write ordering, identical text poses and teardown.
A new production recording is still required to measure the resulting reduction.

## Hero responsive source selection

The supplied desktop Lighthouse navigation requested both forest-wide-2560 and
forest-wide-3840 AVIF files. The coverImageSizes action replaced the initial HTML
sizes with getBoundingClientRect measurements that include the entrance scale.
At a 1653px layout width, production retained a measured 1741px sizes value even
after the scale returned to 1. A density near 1.5 crosses the 2560px candidate
boundary in that interval.

The hero now supplies responsive sizes in the initial HTML and does not attach
that action. The rules reserve the existing 1.055 maximum entrance scale;
portrait sources remain limited to screens up to 700px. The portrait estimate
also allows for the stacked content on short phone screens, rather than relying
on viewport height alone. Images, framing and animation CSS are unchanged.

Local browser checks at 360x640, 390x844, 700x900, 768x1024 and 1663x900 verified
the portrait/landscape selection and stable sizes through the entrance. The
browser override uses density 1; this is not physical mobile-device testing.
Network timing counters are unavailable in this browser tool, so a new production
Lighthouse report is required to verify the final request count and byte saving.

## Reviewed background compression

The image audit separates source selection from compression. In particular,
the catalogue discovery tile uses a portrait image with a permanent 1.55 zoom.
Its old desktop sizes=53vw overstates the cover area. It now starts with a
bounded responsive estimate and uses the actual transformed cover area while
retaining that zoom and the same crop. At a 1663px viewport the measured cover
width is about 586 CSS pixels, rather than the previous 881px estimate.

Backgrounds were encoded from their existing masters, never from smaller
derivatives. Native-size crops were compared for AVIF qualities 70, 65 and 60,
and WebP before/after crops included an amplified difference view. The selected
profiles in scripts/optimize-home-v5-images.mjs are conservative for fine forest
and road texture, with stronger compression for the already blurred discovery
background and the service banner. These comparisons are a perceptual review,
not proof of pixel equality or an exhaustive human evaluation on every display.

The 58 changed derivatives keep all previous pixel dimensions and are all
smaller: 94,106,282 bytes become 84,782,194 bytes (9.9% across those stored
files). This aggregate is not the payload of a page visit: each browser chooses
only the applicable variants. Representative AVIF changes are:

- forest-wide-3840: 3,156,529 -> 2,901,386 bytes;
- catalog-portrait-1080: 663,378 -> 544,534 bytes;
- curves-wide-1920: 816,915 -> 735,844 bytes;
- service-wide-1920: 335,049 -> 244,339 bytes.

Visit backgrounds remain unchanged because their available source resolution
already limits sharpness in tall/high-density layouts. Vehicle photos and their
upload encoding are unchanged in this follow-up. The audit also found cover
crops in some cards and the main vehicle photograph that can need more source
pixels than a width-only sizes hint implies; reducing those resolutions is not
recommended. That source-selection work is distinct from this background pass.

Comparison images and raw measurements are local artifacts under
artifacts/image-audit/compression/, excluded from the intended source changes.

## Cover resolution follow-up

Cards, the main vehicle photograph and the decorative detail band now attach
coverPhotoSizes. After the photo's intrinsic aspect ratio is known, it advertises
max(rendered width, rendered height * source aspect ratio) in CSS pixels. Browser
density is applied once by native srcset selection. Geometry reads and writes
use the existing shared frame scheduler; only load/resize trigger measurements,
not scroll. Source changes remeasure on load, fallback images without srcset are
ignored, and teardown removes observers/listeners and cancels pending work.

Initial HTML keeps its responsive hint because public photo data currently lacks
intrinsic dimensions. A newly decoded cover photo may therefore upgrade once to
a sharper candidate. This is a deliberate quality correction, not a claim that
every photo now needs fewer bytes. The original upload remains the detail limit.

The contact background's original native master is only 1672x941; its 705x941
portrait crop cannot cover the full stacked mobile form sharply. On mobile the
shared contact scene now uses the wider existing master and bounds the painted
height to the smaller of the viewport, section and native height / screen
density. A bottom mask blends the image into the existing dark background.
The contact fields and section layout are unchanged. Desktop framing is retained;
no resampling is presented as newly recovered image detail.

Tests cover tall crop selection, source aspect-ratio changes, unloaded/fallback
images and teardown. Browser checks include the mobile cards, main-photo switch
and contact background. Real-device crash verification remains separate.

## Invisible scene margins

The crop follow-up is restricted to the discovery tile, cabin, homepage hero and
editorial road. Services and vehicle photographs are excluded. Full source
masters remain intact; obsolete generated catalogue derivatives are retired.

- Discovery: remove 12.5% from each side of the 2736x3648 portrait master.
  The 2052x2736 crop retains its aspect ratio. Multiply the existing 1.55 zoom
  by 0.75 and divide the existing 1.2px blur by 0.75. The source-to-screen scale,
  centre and displayed blur are therefore preserved, with extra image pixels
  remaining behind the clipping edge.
- Cabin: keep the full 2560px width, remove 530px above and 470px below the
  2560x3835 master. The unchanged 53% object-position is significant:
  530 = (3835 - 2835) * .53. Both old and new cover paints are width-controlled
  in the supported viewport range, so the visible source coordinates stay the
  same. Geometry tests include the middle panel's 6px width adjustment. Below
  320 CSS pixels the original uncropped CDN source remains the fallback.
- Hero and editorial road: retained uncropped. Wider compositions expose the
  source width, while taller/tablet compositions expose its height. Their union
  needs the complete rectangular source. The parallax/entry travel adds another
  reason not to trim based on a single desktop screenshot.

Tests verify catalogue scale/blur compensation and cabin coordinates/margins at
12 viewport widths from 320 to 2560px. Re-encoding is lossy: equal framing is not
a claim of identical RGB pixels. Native/display-size before/after comparisons
were reviewed for visible degradation; the master sources are preserved.

Compared with the already-compressed pre-crop versions:

- Catalogue's ten generated files: 13,814,661 -> 8,541,669 bytes (5,272,992 saved).
- Cabin's fourteen format/width equivalents: 3,166,562 -> 2,614,556 bytes (552,006
  saved). These previously came from the external CDN. AVIF 1920px is now
  298,161 bytes instead of 360,288; AVIF 640px is 57,324 instead of 70,173.
- Total across those equivalent sets: 5,824,998 bytes saved, not per page visit.
  Because the cabin is now self-hosted, the net reduction in this site's own
  generated asset files is 2,658,436 bytes. Actual downloads depend on selection.

Local crop measurements/comparisons are under artifacts/image-crops/ and are
not intended to be committed. Reproduce via optimize-home-v5-images.mjs
--only=catalog-portrait and optimize-cabin-images.mjs; the latter can fetch the
existing approved interior source if its local master cache is absent.
