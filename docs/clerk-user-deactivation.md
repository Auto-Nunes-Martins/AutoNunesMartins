# Clerk profile deactivation

The backend can boot without `CLERK_WEBHOOK_SECRET`. A missing/blank secret disables only `POST /webhooks/clerk` with HTTP 503. Configured endpoints still require a valid Svix signature over the original body. Authentication and first-access provisioning do not depend on receiving a webhook.

## Behavior after migration

Subscribe the intended Clerk endpoint to `user.created`, `user.updated` and `user.deleted`. A verified deletion marks the existing local profile as deactivated; it never deletes that profile, activity attribution or completed tasks. Its pending TODO/IN_PROGRESS tasks become unassigned in Geral, retaining dates, priority, recurrence and board position. Their board versions increment, and an activity entry records the previous assignee. Scheduled recurring tasks retain the existing scheduled-task visibility rules and can be reassigned using the existing edit flow.

A deletion for an unknown Clerk ID records a tombstone without inventing a profile/email. The tombstone and profile state are terminal for that Clerk ID: delayed create/update events, duplicate deliveries and concurrent first-access provisioning cannot reactivate it. A replacement Clerk account has a different ID and may reuse the old email; retained historical profiles keep their original email.

Permission reads are fresh and inactive profiles receive 403. Only active profiles appear as new task-assignment candidates, and the server independently validates the assignee under the same task-board transaction lock as deletion. Previously admitted requests can finish; this does not revoke already executing business operations. Existing Clerk session/JWT validation remains in force.

## Rollout and safety

1. Deploy the code with its generated Prisma client. It remains compatible with the old database schema using explicit legacy profile selects. Before the migration, `user.deleted` returns 503 without writes so Svix retries; the new deactivation behavior is not active yet.
2. Confirm the intended database target with the owner, including whether it is the test or production project. Apply `backend/prisma/migrations/20261026223000_deactivate_clerk_users/migration.sql` through the project's normal approved Prisma migration procedure (`yarn workspace @anm/backend prisma:migrate:deploy`). No migration is run by the build/launcher or by this implementation task.
3. The backend detects the new table/column on the next request (negative probes are never cached). Configure the endpoint's real signing secret, then verify a signed deletion with a disposable test account on that confirmed target. Retry pending deliveries and replay any user.deleted messages that an older deployment acknowledged before this feature was installed. Do not delete real users to test the integration.

The migration adds nullable `User.deactivatedAt` and `ClerkUserDeletion`, and replaces unique email with a regular index; Clerk ID remains unique. It does not update any existing business rows or hard-delete data. No new user-management UI or public-registration policy is introduced. The tombstone must be retained for as long as delayed events or old tokens could be presented; do not remove it as routine cleanup.

Local development was kept running on the previously compiled backend without watch during schema preparation. Restarting it from source after rollout will load the new code; an unmigrated database still uses the compatibility behavior above. No remote database migration, Clerk configuration or manual Render deployment was performed.

## Validation

Local tests cover real Svix signing/tampering and disabled endpoint behavior; known/unknown deletion, replay and stale events; transaction rollback and both assignment/deletion orders; auth rejection, active-only candidates and in-flight cache invalidation; and applying the migration to disposable PostgreSQL (PGlite), preserving historical references and detecting schema readiness. Physical iPhone behavior is separate from these backend tests.
