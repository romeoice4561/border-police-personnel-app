-- DI-11E.3: optional Task -> Note provenance. Additive only —
-- nullable sourceTaskId + Restrict FK + lookup index.
-- No DROP, no backfill, no enum change, no Note/Task data rewrite.

-- AlterTable
ALTER TABLE "DrugAnalystNote" ADD COLUMN "sourceTaskId" TEXT;

-- CreateIndex
CREATE INDEX "DrugAnalystNote_sourceTaskId_createdAt_id_idx" ON "DrugAnalystNote"("sourceTaskId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "DrugAnalystNote" ADD CONSTRAINT "DrugAnalystNote_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "DrugInvestigationTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
