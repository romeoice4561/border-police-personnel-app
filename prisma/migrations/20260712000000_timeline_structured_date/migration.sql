-- Phase 26B Part 3: Timeline structured date model (additive, non-destructive).
--
-- Adds structured Day / Month / Buddhist-Year / Present columns to Timeline,
-- alongside the EXISTING free-text `year` column (never altered, never
-- dropped — every legacy row and every Phase 25 import keeps working
-- unchanged). `effectiveDate` is a real DATE, auto-derived from the
-- structured fields (day defaults to 1, month defaults to 1 when unknown) so
-- rows can be sorted/compared without re-parsing Thai text at query time.
--
-- All new columns are nullable with no default that invents data — an
-- existing row that hasn't been migrated by the backfill script yet simply
-- has day/month/yearBE/effectiveDate = NULL and isPresent = false, and
-- displays/sorts exactly as before (CareerTimelineSection/sortTimelineByYear
-- fall back to the legacy `year`/`yearValue` columns, unchanged).
--
-- No existing column altered or dropped. No row deleted.

ALTER TABLE "Timeline" ADD COLUMN "day" INTEGER;
ALTER TABLE "Timeline" ADD COLUMN "month" INTEGER;
ALTER TABLE "Timeline" ADD COLUMN "yearBE" INTEGER;
ALTER TABLE "Timeline" ADD COLUMN "isPresent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Timeline" ADD COLUMN "effectiveDate" DATE;

CREATE INDEX "Timeline_effectiveDate_idx" ON "Timeline"("effectiveDate");
CREATE INDEX "Timeline_yearBE_idx" ON "Timeline"("yearBE");
