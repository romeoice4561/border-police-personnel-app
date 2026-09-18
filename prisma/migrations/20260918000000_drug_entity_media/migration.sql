-- Entity Media / Visual Identity. Additive only — no existing table changes.
-- Bytes live in the private drug-intelligence storage bucket.

CREATE TABLE "DrugEntityMedia" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'PHOTO',
    "category" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "description" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sourceCaseId" TEXT,
    "capturedAt" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugEntityMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrugEntityMedia_entityType_entityId_idx" ON "DrugEntityMedia"("entityType", "entityId");

CREATE INDEX "DrugEntityMedia_entityType_entityId_isPrimary_idx" ON "DrugEntityMedia"("entityType", "entityId", "isPrimary");

CREATE INDEX "DrugEntityMedia_sourceCaseId_idx" ON "DrugEntityMedia"("sourceCaseId");

-- At most one primary photo per entity.
CREATE UNIQUE INDEX "DrugEntityMedia_one_primary_per_entity" ON "DrugEntityMedia"("entityType", "entityId") WHERE "isPrimary" = true;
