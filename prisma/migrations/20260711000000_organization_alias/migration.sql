-- Phase 27: Organization Engine — OrganizationAlias table.
--
-- Additive only. Creates ONE new table; alters no existing table, column,
-- or row. Region/Battalion/Company are completely unchanged by this
-- migration. The table starts EMPTY — populating it (migrating the
-- observed-but-not-official company codes out of organization_seed.ts into
-- aliases, adding OCR-variant text, etc.) is a separate, future, dedicated
-- data-migration phase, not part of this one.
--
-- Purpose: maps a legacy/OCR-variant/unofficial text string to a real,
-- still-registered Region/Battalion/Company row — distinct from the
-- existing UnresolvedOrganizationCode table, which is for text that maps to
-- NOTHING. OrganizationEngine.normalizeRegion/normalizeBattalion/
-- normalizeCompany consult this table (in addition to exact/generated-label
-- matching) so a recognized variant resolves to its canonical code.

CREATE TABLE "OrganizationAlias" (
    "id" SERIAL NOT NULL,
    "aliasText" TEXT NOT NULL,
    "canonicalRegionId" INTEGER,
    "canonicalBattalionId" INTEGER,
    "canonicalCompanyId" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAlias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationAlias_aliasText_idx" ON "OrganizationAlias"("aliasText");
CREATE INDEX "OrganizationAlias_canonicalRegionId_idx" ON "OrganizationAlias"("canonicalRegionId");
CREATE INDEX "OrganizationAlias_canonicalBattalionId_idx" ON "OrganizationAlias"("canonicalBattalionId");
CREATE INDEX "OrganizationAlias_canonicalCompanyId_idx" ON "OrganizationAlias"("canonicalCompanyId");

ALTER TABLE "OrganizationAlias" ADD CONSTRAINT "OrganizationAlias_canonicalRegionId_fkey"
    FOREIGN KEY ("canonicalRegionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationAlias" ADD CONSTRAINT "OrganizationAlias_canonicalBattalionId_fkey"
    FOREIGN KEY ("canonicalBattalionId") REFERENCES "Battalion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationAlias" ADD CONSTRAINT "OrganizationAlias_canonicalCompanyId_fkey"
    FOREIGN KEY ("canonicalCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
