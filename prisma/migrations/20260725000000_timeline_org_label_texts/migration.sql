-- Phase 49A.2B: Timeline organization free-text labels (additive, non-destructive).
--
-- Persists the exact headquarters / region / battalion / company labels the
-- user entered or selected, independently of Timeline.unit and independently
-- of the structured id FKs. Pre-existing rows keep NULL labels and continue
-- to hydrate from resolveLabels(ids) when present.
--
-- No existing column is altered or dropped.

ALTER TABLE "Timeline" ADD COLUMN "headquartersText" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "regionText" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "battalionText" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "companyText" TEXT;
