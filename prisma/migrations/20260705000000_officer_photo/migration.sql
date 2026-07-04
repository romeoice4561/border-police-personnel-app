-- Phase 17B: Officer photo identity (additive, non-destructive).
--
-- Adds three nullable columns preserving the Google Drive image identity that
-- produced each officer's OCR record. No renames, no deletes, no data loss:
-- existing rows receive NULL and continue to work unchanged (the UI falls back
-- to a placeholder when these are null).

ALTER TABLE "Officer" ADD COLUMN "driveFileId" TEXT;
ALTER TABLE "Officer" ADD COLUMN "thumbnailUrl" TEXT;
ALTER TABLE "Officer" ADD COLUMN "webViewUrl" TEXT;
