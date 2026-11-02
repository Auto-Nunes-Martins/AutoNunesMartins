# Vehicle deletion and photo cleanup

Deleting a vehicle without sale/trade-in dependencies preserves activity history. The existing database cascades remove its expenses and photo-dimension rows.

The same transaction now saves a private `VehiclePhotoCleanup` job. After commit, the server removes the vehicle's master photos, generated widths and manifest sidecars using the existing Storage deletion helper. It also inventories image masters and v1 variant folders in that exact vehicle namespace to include staged or interrupted uploads that never reached `Vehicle.photos`. It never deletes a whole bucket or arbitrary prefixes; unrelated vehicles and non-image files are outside this operation.

Successful cleanup removes the job. Database or Storage failures retain it for retries with capped exponential backoff. The backend checks pending jobs at startup and every 30 seconds. A restored vehicle blocks an older job from deleting its live photos. A database rollback never triggers Storage deletion. No historical cleanup of previously deleted vehicles is started by this change.

The migration enables RLS and revokes browser-role access to the queue. No activity rows are purged. A Storage outage can delay file removal after the CRM record is deleted; the retry inventory is persistent rather than relying on a log line.

Validation uses a simulated Storage bucket and isolated in-memory PostgreSQL, including transaction rollback, partial deletion/retry, startup recovery, staged objects, namespace boundaries, restored vehicles, pagination and browser-role permissions. No production vehicle was deleted to validate this feature.

## Per-photo lifecycle correction — 2 November 2026

Local implementation; not yet deployed by this task. The additive migration is `20261102060000_photo_lifecycle_jobs`; it must run through the normal startup migration flow before this release starts. Do not apply the separately deferred diagnostic DROP while old callers still run.

`VehiclePhotoJob` persists the exact master path before the first Storage write. UPLOADING has a 15-minute lease, renewed every 30 seconds and checked before each master/variant/manifest write. Failed work is queued immediately; a crashed process leaves its persisted lease for the startup/30-second worker. STAGED preserves a completed private upload for seven inactive days. Open/recovered editors renew their current staged paths each minute and on focus; browser recovery retains its File/upload identity. A missing expired object is reported for re-upload, never attached as a dead path. This does not depend on unload callbacks.

An explicit discard/removal of a prepared draft queues cleanup after ten minutes, allowing another still-open editor to renew its own copy. Closing a tab without a callback is covered by expiry. Merely selecting/removing a local File before upload creates no Storage object. Photos already saved in the gallery remain attached until a successful save/delete.

Revoking a saved path and creating its cleanup job happen in the same PostgreSQL transaction. Failed Storage removal leaves a durable retry with backoff; rollback leaves the gallery intact. The worker rechecks both photo arrays across all vehicles, locks the owner and job during a bounded Storage delete, and removes only deterministic variants/manifest/dimensions for that exact master. A renewed lease cannot be shortened by a delayed retry. A restored owner generation or pending whole-vehicle deletion blocks cleanup. Existing whole-vehicle namespace cleanup remains in place.

The model intentionally stores pending work only, without a Vehicle FK, so a deleted parent cannot erase cleanup intent. Successful attachment/cleanup removes its job; there is no diagnostic event history. Browser roles have no grants and RLS is enabled. Pending uploads are bounded per vehicle. Existing immutable-upload conflicts retain the previous private object instead of deleting it on an ambiguous read/error.

Manual cleanup authorized separately removed the two displayed Nissan Note masters plus their exclusive children (13 objects, 1,960,272 bytes) and two dimension records. Private copies and hashes were verified first. Current gallery arrays were unchanged and all 214 referenced masters remained present. No release or migration was applied to production as part of this correction.
