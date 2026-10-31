# Vehicle deletion and photo cleanup

Deleting a vehicle without sale/trade-in dependencies preserves activity history and runtime diagnostics. The existing database cascades remove its expenses and photo-dimension rows.

The same transaction now saves a private `VehiclePhotoCleanup` job. After commit, the server removes the vehicle's master photos, generated widths and manifest sidecars using the existing Storage deletion helper. It also inventories image masters and v1 variant folders in that exact vehicle namespace to include staged or interrupted uploads that never reached `Vehicle.photos`. It never deletes a whole bucket or arbitrary prefixes; unrelated vehicles and non-image files are outside this operation.

Successful cleanup removes the job. Database or Storage failures retain it for retries with capped exponential backoff. The backend checks pending jobs at startup and every 30 seconds. A restored vehicle blocks an older job from deleting its live photos. A database rollback never triggers Storage deletion. No historical cleanup of previously deleted vehicles is started by this change.

The migration enables RLS and revokes browser-role access to the queue. No diagnostics or activity rows are purged. A Storage outage can delay file removal after the CRM record is deleted; the retry inventory is persistent rather than relying on a log line.

Validation uses a simulated Storage bucket and isolated in-memory PostgreSQL, including transaction rollback, partial deletion/retry, startup recovery, staged objects, namespace boundaries, restored vehicles, pagination and browser-role permissions. No production vehicle was deleted to validate this feature.
