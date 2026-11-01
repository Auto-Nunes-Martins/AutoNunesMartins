-- Preserve all existing integer ratings; binary-exact halves serialize as JSON numbers.
-- Bounds also reject PostgreSQL NaN and infinities. No rows are inserted or removed.
ALTER TABLE "WebReview"
  DROP CONSTRAINT "WebReview_rating",
  ALTER COLUMN "rating" TYPE DOUBLE PRECISION USING "rating"::DOUBLE PRECISION,
  ADD CONSTRAINT "WebReview_rating" CHECK (
    "rating" >= 0.5 AND "rating" <= 5 AND "rating" * 2 = trunc("rating" * 2)
  );
