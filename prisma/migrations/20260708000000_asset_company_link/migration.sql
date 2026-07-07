-- Phase 20B: link Gallery Asset rows to the Organization master data
-- (additive, non-destructive). Adds a nullable `companyId` FK to Asset,
-- resolved at import time from the existing `company` text field via
-- OrganizationService. The `company`/`battalion`/`region` text columns are
-- UNCHANGED and remain the source of truth for assets that don't resolve to
-- a registered Company. ON DELETE SET NULL so removing a Company can never
-- block or cascade-delete Assets.

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "companyId" INTEGER;

-- CreateIndex
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
