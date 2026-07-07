-- Phase 21C: Universal Profile Photo Inbox (additive, non-destructive).
--
-- Creates the standalone "ProfilePhoto" table. Every image discovered under a
-- Drive "Profile รายบุคคล ..." folder gets exactly one row here regardless of
-- OCR/match outcome, guaranteeing no Profile image is ever lost. Completely
-- independent from Officer (no foreign key to Officer) — matchedOfficerId is
-- a plain nullable string reference to Officer.officerId. No changes to
-- Officer/Timeline/Phone/Unit/Asset/Region/Battalion/Company/ImportJob/
-- ImportLog.

-- CreateTable
CREATE TABLE "ProfilePhoto" (
    "id" SERIAL NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "webViewUrl" TEXT,
    "filename" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "region" TEXT,
    "company" TEXT,
    "battalion" TEXT,
    "ocrText" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "matchStatus" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "matchedOfficerId" TEXT,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePhoto_driveFileId_key" ON "ProfilePhoto"("driveFileId");

-- CreateIndex
CREATE INDEX "ProfilePhoto_matchStatus_idx" ON "ProfilePhoto"("matchStatus");

-- CreateIndex
CREATE INDEX "ProfilePhoto_region_idx" ON "ProfilePhoto"("region");

-- CreateIndex
CREATE INDEX "ProfilePhoto_company_idx" ON "ProfilePhoto"("company");

-- CreateIndex
CREATE INDEX "ProfilePhoto_battalion_idx" ON "ProfilePhoto"("battalion");

-- CreateIndex
CREATE INDEX "ProfilePhoto_matchedOfficerId_idx" ON "ProfilePhoto"("matchedOfficerId");

-- CreateIndex
CREATE INDEX "ProfilePhoto_ocrStatus_idx" ON "ProfilePhoto"("ocrStatus");
