-- Additive only. No example reviews, backfill, changes to existing tables or seed.
CREATE TABLE "WebReview" (
  "id" TEXT NOT NULL,
  "authorName" VARCHAR(100) NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" VARCHAR(5000) NOT NULL,
  "avatarData" BYTEA,
  "avatarVersion" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebReview_rating" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "WebReview_author" CHECK (length(trim("authorName")) > 0),
  CONSTRAINT "WebReview_text" CHECK (length(trim("text")) > 0),
  CONSTRAINT "WebReview_avatar" CHECK (
    ("avatarData" IS NULL AND "avatarVersion" IS NULL) OR
    ("avatarData" IS NOT NULL AND "avatarVersion" IS NOT NULL AND "avatarVersion" ~ '^[a-f0-9]{64}$' AND octet_length("avatarData") <= 65536)
  )
);
CREATE INDEX "WebReview_createdAt_id_idx" ON "WebReview"("createdAt", "id");

-- Public reads are an explicit minimal API projection, never direct Supabase table access.
ALTER TABLE "WebReview" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "WebReview" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON "WebReview" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON "WebReview" FROM authenticated;
  END IF;
END $$;
