-- Phase 26B Part C/H: Headquarters master data + Timeline/Officer structured
-- organization hierarchy (additive, non-destructive).
--
-- Adds:
--   1. Headquarters — new top-level RTP organization master table
--      (บช.ตชด., บช.น., ภ.1-9, บช.ก., รร.นรต., ...). Standalone; Region gets
--      an OPTIONAL headquartersId so the existing Region -> Battalion ->
--      Company hierarchy (Phase 20A) becomes the "Border Patrol Division"
--      branch under Headquarters, with no parallel/duplicated tables.
--   2. Region.headquartersId (nullable FK, SetNull).
--   3. Officer.headquartersId (nullable FK, SetNull) — mirrors the existing
--      Officer.regionId/battalionId/companyId (Phase 20C) convention.
--   4. Timeline.headquartersId/regionId/battalionId/companyId (nullable FK,
--      SetNull) — additive alongside the existing free-text Timeline.unit
--      column, which is never altered or dropped.
--
-- No existing column altered or dropped. No row deleted. No Phase 25 data
-- touched. No backfill — every existing Region/Officer/Timeline row simply
-- has these new columns NULL until explicitly set via the new UI or a
-- future backfill script (mirrors the Phase 26A officialPortraitId and
-- Phase 26B Part 3 day/month/yearBE precedent: additive columns, zero
-- guessing).

CREATE TABLE "Headquarters" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Headquarters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Headquarters_code_key" ON "Headquarters"("code");
CREATE INDEX "Headquarters_displayOrder_idx" ON "Headquarters"("displayOrder");

-- Region.headquartersId
ALTER TABLE "Region" ADD COLUMN "headquartersId" INTEGER;
CREATE INDEX "Region_headquartersId_idx" ON "Region"("headquartersId");
ALTER TABLE "Region"
  ADD CONSTRAINT "Region_headquartersId_fkey"
  FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Officer.headquartersId
ALTER TABLE "Officer" ADD COLUMN "headquartersId" INTEGER;
CREATE INDEX "Officer_headquartersId_idx" ON "Officer"("headquartersId");
ALTER TABLE "Officer"
  ADD CONSTRAINT "Officer_headquartersId_fkey"
  FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Timeline.headquartersId / regionId / battalionId / companyId
ALTER TABLE "Timeline" ADD COLUMN "headquartersId" INTEGER;
ALTER TABLE "Timeline" ADD COLUMN "regionId" INTEGER;
ALTER TABLE "Timeline" ADD COLUMN "battalionId" INTEGER;
ALTER TABLE "Timeline" ADD COLUMN "companyId" INTEGER;

CREATE INDEX "Timeline_headquartersId_idx" ON "Timeline"("headquartersId");
CREATE INDEX "Timeline_regionId_idx" ON "Timeline"("regionId");
CREATE INDEX "Timeline_battalionId_idx" ON "Timeline"("battalionId");
CREATE INDEX "Timeline_companyId_idx" ON "Timeline"("companyId");

ALTER TABLE "Timeline"
  ADD CONSTRAINT "Timeline_headquartersId_fkey"
  FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timeline"
  ADD CONSTRAINT "Timeline_regionId_fkey"
  FOREIGN KEY ("regionId") REFERENCES "Region"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timeline"
  ADD CONSTRAINT "Timeline_battalionId_fkey"
  FOREIGN KEY ("battalionId") REFERENCES "Battalion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Timeline"
  ADD CONSTRAINT "Timeline_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
