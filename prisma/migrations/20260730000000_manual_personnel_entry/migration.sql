-- Phase XX — Manual Personnel Entry (Admin Only)
-- Adds provenance ("source") and audit (createdBy/updatedBy) fields to
-- Officer, plus a free-text employmentStatus field. Every existing row gets
-- source = 'import' via the column default, so no pre-existing officer is
-- reclassified. All new columns are nullable except source (defaulted), so
-- this migration is purely additive.

ALTER TABLE "Officer" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'import';
ALTER TABLE "Officer" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Officer" ADD COLUMN "createdByName" TEXT;
ALTER TABLE "Officer" ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Officer" ADD COLUMN "updatedByName" TEXT;
ALTER TABLE "Officer" ADD COLUMN "employmentStatus" TEXT;
ALTER TABLE "Officer" ADD COLUMN "policeServiceNumber" TEXT;

CREATE INDEX "Officer_citizenId_idx" ON "Officer"("citizenId");
CREATE INDEX "Officer_source_idx" ON "Officer"("source");
CREATE INDEX "Officer_policeServiceNumber_idx" ON "Officer"("policeServiceNumber");
