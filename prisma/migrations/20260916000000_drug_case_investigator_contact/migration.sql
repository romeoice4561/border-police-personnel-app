-- Case-level investigating-officer administrative contact.
-- Additive only: nullable columns, no backfill, no index, no enum change.
-- These fields are NOT DrugPhoneNumber / DrugCasePhone intelligence.

ALTER TABLE "DrugCase" ADD COLUMN "investigatorName" TEXT;
ALTER TABLE "DrugCase" ADD COLUMN "investigatorPhone" TEXT;
