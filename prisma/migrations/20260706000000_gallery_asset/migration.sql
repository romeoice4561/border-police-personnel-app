-- Phase 19B: Gallery Asset persistence (additive, non-destructive).
--
-- Creates the standalone "Asset" table for non-profile visual assets. No
-- changes to Officer/Timeline/Phone/Unit/ImportJob/ImportLog. `assetId` is a
-- unique idempotent upsert key; indexes back the Gallery's category/region/
-- company/battalion filters and the category+region / category+company facets.

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "assetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT,
    "company" TEXT,
    "battalion" TEXT,
    "folderName" TEXT,
    "relativePath" TEXT NOT NULL,
    "driveFileId" TEXT,
    "thumbnailUrl" TEXT,
    "webViewUrl" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "createdTime" TIMESTAMP(3),
    "updatedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetId_key" ON "Asset"("assetId");

-- CreateIndex
CREATE INDEX "Asset_category_idx" ON "Asset"("category");

-- CreateIndex
CREATE INDEX "Asset_region_idx" ON "Asset"("region");

-- CreateIndex
CREATE INDEX "Asset_company_idx" ON "Asset"("company");

-- CreateIndex
CREATE INDEX "Asset_battalion_idx" ON "Asset"("battalion");

-- CreateIndex
CREATE INDEX "Asset_category_region_idx" ON "Asset"("category", "region");

-- CreateIndex
CREATE INDEX "Asset_category_company_idx" ON "Asset"("category", "company");
