-- Phase 26A: Official Portrait Architecture (additive, non-destructive).
--
-- Adds:
--   1. ProfilePhoto.photoType — what the image fundamentally is
--      (GOOGLE_PROFILE_CARD | OFFICIAL_PORTRAIT | UPLOADED | OTHER).
--      Backfilled below so existing rows classify correctly on day one:
--        - every existing row defaults to 'GOOGLE_PROFILE_CARD' (accurate —
--          every pre-26A row came from the Phase 25 Drive rebuild);
--        - rows whose sourceType is already 'UPLOAD' (Phase 24B-1 manual
--          uploads) are updated to 'UPLOADED' so the two columns agree.
--   2. Officer.officialPortraitId — a nullable pointer to the ProfilePhoto row
--      that is this officer's pinned OFFICIAL portrait. NULL for every
--      existing officer (no backfill — nothing has been explicitly
--      designated "official" yet); the existing portrait resolver tiers are
--      completely unaffected until this is set.
--
-- No existing column altered or dropped. No row deleted. No Phase 25 data
-- touched (Officer/Timeline/Phone rows are not modified by this migration).

-- ProfilePhoto.photoType
ALTER TABLE "ProfilePhoto" ADD COLUMN "photoType" TEXT NOT NULL DEFAULT 'GOOGLE_PROFILE_CARD';
UPDATE "ProfilePhoto" SET "photoType" = 'UPLOADED' WHERE "sourceType" = 'UPLOAD';
CREATE INDEX "ProfilePhoto_photoType_idx" ON "ProfilePhoto"("photoType");

-- Officer.officialPortraitId (nullable FK; SetNull so a ProfilePhoto change
-- can never cascade into Officer — in practice ProfilePhoto rows are never
-- deleted, portrait history is permanent).
ALTER TABLE "Officer" ADD COLUMN "officialPortraitId" INTEGER;
CREATE INDEX "Officer_officialPortraitId_idx" ON "Officer"("officialPortraitId");
ALTER TABLE "Officer"
  ADD CONSTRAINT "Officer_officialPortraitId_fkey"
  FOREIGN KEY ("officialPortraitId") REFERENCES "ProfilePhoto"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
