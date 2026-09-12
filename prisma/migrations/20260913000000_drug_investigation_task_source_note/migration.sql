-- DI-11E.1: optional Note -> Task provenance. Additive only —
-- nullable sourceNoteId + Restrict FK + lookup index.
-- No DROP, no backfill, no enum change, no Note/Task data rewrite.

-- AlterTable
ALTER TABLE "DrugInvestigationTask" ADD COLUMN "sourceNoteId" TEXT;

-- CreateIndex
CREATE INDEX "DrugInvestigationTask_sourceNoteId_createdAt_id_idx" ON "DrugInvestigationTask"("sourceNoteId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "DrugInvestigationTask" ADD CONSTRAINT "DrugInvestigationTask_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "DrugAnalystNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
