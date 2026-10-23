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
