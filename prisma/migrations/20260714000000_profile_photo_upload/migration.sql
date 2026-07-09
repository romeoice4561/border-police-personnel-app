-- Phase 24B-1: Officer Portrait Upload (additive, non-destructive).
--
-- Adds portrait-upload metadata columns to the existing ProfilePhoto table so
-- an uploaded portrait reuses this exact entity (no new storage table, no
-- change to any existing column). Google Drive stays strictly read-only —
-- uploaded portrait bytes live in Supabase Storage; only URLs/metadata are
-- persisted here. Existing Drive-discovered rows keep the defaults below
-- (sourceType='DRIVE_SCAN', isProfile=false, others null), so their behavior
-- is unchanged.

ALTER TABLE "ProfilePhoto" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'DRIVE_SCAN';
ALTER TABLE "ProfilePhoto" ADD COLUMN "storagePath" TEXT;
ALTER TABLE "ProfilePhoto" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "ProfilePhoto" ADD COLUMN "width" INTEGER;
ALTER TABLE "ProfilePhoto" ADD COLUMN "height" INTEGER;
ALTER TABLE "ProfilePhoto" ADD COLUMN "uploadedBy" TEXT;
ALTER TABLE "ProfilePhoto" ADD COLUMN "isProfile" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProfilePhoto_sourceType_idx" ON "ProfilePhoto"("sourceType");
CREATE INDEX "ProfilePhoto_matchedOfficerId_isProfile_idx" ON "ProfilePhoto"("matchedOfficerId", "isProfile");
