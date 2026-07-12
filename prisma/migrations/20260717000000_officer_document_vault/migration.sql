-- Phase 29A: Officer Document Vault Foundation (additive, non-destructive).
--
-- Adds:
--   1. OfficerDocument — one document row per officer per upload. Generic:
--      `documentType` is free-text (never a DB enum) so new types never
--      require a schema migration. `isActive` enables soft-delete/version
--      history without destroying any row. `storagePath`/`fileUrl` are null
--      for metadata-only rows (type acknowledged, no file uploaded yet).
--
-- No existing table, column, or row is altered. This table is intentionally
-- minimal (foundation only) — no OCR, no AI, no auto-classification columns
-- exist yet; future phases read this table rather than requiring schema
-- changes here.

CREATE TABLE "OfficerDocument" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storagePath" TEXT,
    "fileUrl" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3),
    "uploadedBy" TEXT,
    "verifiedAt" DATE,
    "verifiedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfficerDocument_officerId_idx" ON "OfficerDocument"("officerId");
CREATE INDEX "OfficerDocument_documentType_idx" ON "OfficerDocument"("documentType");
CREATE INDEX "OfficerDocument_isActive_idx" ON "OfficerDocument"("isActive");
CREATE INDEX "OfficerDocument_officerId_documentType_idx" ON "OfficerDocument"("officerId", "documentType");
CREATE INDEX "OfficerDocument_officerId_isActive_idx" ON "OfficerDocument"("officerId", "isActive");

ALTER TABLE "OfficerDocument" ADD CONSTRAINT "OfficerDocument_officerId_fkey"
    FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
