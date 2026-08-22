-- Phase DI-6: Repeat Entity Detection & Intelligence Alerts. Purely
-- additive — one new table, no existing table altered, no FKs to existing
-- Drug Intelligence tables (entityId/currentCaseId/priorCaseIds are loose
-- string references by design, mirroring DrugAuditLog/DrugRelationship, so
-- alert history survives later edits/merges to the referenced records).

-- CreateTable
CREATE TABLE "DrugIntelligenceAlert" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "currentCaseId" TEXT,
    "priorCaseIds" JSONB NOT NULL,
    "relatedPersonIds" JSONB,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reviewedBy" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "dismissReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugIntelligenceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DrugIntelligenceAlert_dedupeKey_key" ON "DrugIntelligenceAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "DrugIntelligenceAlert_status_idx" ON "DrugIntelligenceAlert"("status");

-- CreateIndex
CREATE INDEX "DrugIntelligenceAlert_severity_idx" ON "DrugIntelligenceAlert"("severity");

-- CreateIndex
CREATE INDEX "DrugIntelligenceAlert_entityType_entityId_idx" ON "DrugIntelligenceAlert"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DrugIntelligenceAlert_currentCaseId_idx" ON "DrugIntelligenceAlert"("currentCaseId");

-- CreateIndex
CREATE INDEX "DrugIntelligenceAlert_createdAt_idx" ON "DrugIntelligenceAlert"("createdAt");
