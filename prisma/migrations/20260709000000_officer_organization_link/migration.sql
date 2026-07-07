-- Phase 20C: link Officer rows to the Organization master data (additive,
-- non-destructive). Adds nullable regionId/battalionId/companyId FKs to
-- Officer, intended to be resolved via OrganizationService as a HELPER
-- reference only. The existing `region`, `currentUnit`, and Timeline.unit
-- text columns are UNCHANGED and remain the source of truth. No backfill is
-- performed by this migration. ON DELETE SET NULL so removing a Region/
-- Battalion/Company can never block or cascade-delete Officer rows.

-- AlterTable
ALTER TABLE "Officer" ADD COLUMN "regionId" INTEGER;
ALTER TABLE "Officer" ADD COLUMN "battalionId" INTEGER;
ALTER TABLE "Officer" ADD COLUMN "companyId" INTEGER;

-- CreateIndex
CREATE INDEX "Officer_regionId_idx" ON "Officer"("regionId");

-- CreateIndex
CREATE INDEX "Officer_battalionId_idx" ON "Officer"("battalionId");

-- CreateIndex
CREATE INDEX "Officer_companyId_idx" ON "Officer"("companyId");

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_battalionId_fkey" FOREIGN KEY ("battalionId") REFERENCES "Battalion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
