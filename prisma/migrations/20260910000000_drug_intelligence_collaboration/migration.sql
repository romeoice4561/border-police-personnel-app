-- DI-11B: Collaboration data foundation. Additive only —
-- new enums + DrugAnalystNote + DrugInvestigationTask.
-- No DROP TABLE, no DROP COLUMN, no existing Drug Intelligence data rewrite,
-- no Person merge, no factual graph / junction / Map / Timeline changes.
-- CASE/PERSON XOR is enforced in Zod/service (this repo does not use DB CHECK).

-- CreateEnum
CREATE TYPE "DrugInvestigationTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DrugInvestigationTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "DrugAnalystNote" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "caseId" TEXT,
    "personId" TEXT,
    "authorActorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByActorId" TEXT,
    "updatedByName" TEXT,

    CONSTRAINT "DrugAnalystNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugInvestigationTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "caseId" TEXT,
    "personId" TEXT,
    "assignedActorId" TEXT,
    "assignedActorName" TEXT,
    "dueAt" TIMESTAMP(3),
    "priority" "DrugInvestigationTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "DrugInvestigationTaskStatus" NOT NULL DEFAULT 'OPEN',
    "createdByActorId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByActorId" TEXT,
    "updatedByName" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DrugInvestigationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugAnalystNote_caseId_createdAt_idx" ON "DrugAnalystNote"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "DrugAnalystNote_personId_createdAt_idx" ON "DrugAnalystNote"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "DrugAnalystNote_authorActorId_idx" ON "DrugAnalystNote"("authorActorId");

-- CreateIndex
CREATE INDEX "DrugInvestigationTask_status_dueAt_idx" ON "DrugInvestigationTask"("status", "dueAt");

-- CreateIndex
CREATE INDEX "DrugInvestigationTask_assignedActorId_status_idx" ON "DrugInvestigationTask"("assignedActorId", "status");

-- CreateIndex
CREATE INDEX "DrugInvestigationTask_caseId_status_idx" ON "DrugInvestigationTask"("caseId", "status");

-- CreateIndex
CREATE INDEX "DrugInvestigationTask_personId_status_idx" ON "DrugInvestigationTask"("personId", "status");

-- AddForeignKey
ALTER TABLE "DrugAnalystNote" ADD CONSTRAINT "DrugAnalystNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugAnalystNote" ADD CONSTRAINT "DrugAnalystNote_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugInvestigationTask" ADD CONSTRAINT "DrugInvestigationTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugInvestigationTask" ADD CONSTRAINT "DrugInvestigationTask_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
