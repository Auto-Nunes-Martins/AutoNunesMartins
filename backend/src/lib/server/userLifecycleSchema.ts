import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';

// Old-schema deployments keep serving existing CRM flows. Deletion must fail
// closed until the additive migration is installed; Svix can retry afterwards.
let available = false;
export async function userLifecycleAvailable(
  db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma,
): Promise<boolean> {
  if (available) return true;
  // Never cache a negative probe: another backend may already have processed
  // deletion immediately after migration. Permission/provisioning must see it.
  const rows = await db.$queryRaw<{ ready: boolean }[]>`
    SELECT to_regclass('"ClerkUserDeletion"') IS NOT NULL AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'deactivatedAt'
    ) AS ready`;
  if (rows[0]?.ready === true) available = true;
  return available;
}
export class UserLifecycleMigrationRequired extends Error {
  readonly status = 503;
  constructor() {
    super('User lifecycle migration required');
  }
}

export const userIdentitySelect = {
  id: true,
  clerkId: true,
  email: true,
  name: true,
  imageUrl: true,
  role: true,
} as const;

export async function lockClerkIdentity(tx: Prisma.TransactionClient, clerkId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(91828, hashtext(${clerkId}))`;
}
