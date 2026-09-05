-- DI-9.5B: Saved Investigation Boards. Purely additive — one enum, one
-- table, no existing Drug Intelligence table altered, no FKs to factual
-- graph / junction / network-group tables. Owner and focus fields are
-- loose strings (same convention as DrugAuditLog / DrugCase.createdBy).

-- CreateEnum
CREATE TYPE "DrugInvestigationBoardStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DrugInvestigationBoard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "DrugInvestigationBoardStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerActorId" TEXT NOT NULL,
    "ownerActorName" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "focusType" TEXT,
    "focusId" TEXT,
    "state" JSONB NOT NULL,

    CONSTRAINT "DrugInvestigationBoard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugInvestigationBoard_ownerActorId_status_updatedAt_idx" ON "DrugInvestigationBoard"("ownerActorId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "DrugInvestigationBoard_status_idx" ON "DrugInvestigationBoard"("status");

-- CreateIndex
CREATE INDEX "DrugInvestigationBoard_updatedAt_idx" ON "DrugInvestigationBoard"("updatedAt");

-- CreateIndex
CREATE INDEX "DrugInvestigationBoard_focusType_focusId_idx" ON "DrugInvestigationBoard"("focusType", "focusId");
