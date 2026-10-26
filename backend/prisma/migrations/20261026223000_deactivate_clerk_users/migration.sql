-- Additive lifecycle state: retain profiles, task history and activity attribution.
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
CREATE TABLE "ClerkUserDeletion" (
  "clerkId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClerkUserDeletion_pkey" PRIMARY KEY ("clerkId")
);
-- Clerk ID is the identity. A replacement account may reuse an old email while
-- the inactive profile retains its original email for historical attribution.
DROP INDEX "User_email_key";
CREATE INDEX "User_email_idx" ON "User"("email");
