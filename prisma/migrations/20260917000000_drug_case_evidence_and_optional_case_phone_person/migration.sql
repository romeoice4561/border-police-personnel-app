-- Additive only. Do not apply to production from this task.
--
-- 1. DrugCasePhone.personId becomes nullable so a seized phone can be
--    linked to a case without fabricating Person ownership.
-- 2. DrugCaseEvidenceItem stores FIREARM / OTHER seized evidence that has
--    no canonical intelligence entity. No Network relations.

ALTER TABLE "DrugCasePhone" DROP CONSTRAINT "DrugCasePhone_personId_fkey";

ALTER TABLE "DrugCasePhone" ALTER COLUMN "personId" DROP NOT NULL;

ALTER TABLE "DrugCasePhone" ADD CONSTRAINT "DrugCasePhone_personId_fkey" FOREIGN KEY ("personId") REFERENCES "DrugPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "DrugCaseEvidenceKind" AS ENUM ('FIREARM', 'OTHER');

CREATE TABLE "DrugCaseEvidenceItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "DrugCaseEvidenceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "serialNumber" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "caliberOrSize" TEXT,
    "recordedDescription" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugCaseEvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrugCaseEvidenceItem_caseId_idx" ON "DrugCaseEvidenceItem"("caseId");
CREATE INDEX "DrugCaseEvidenceItem_kind_idx" ON "DrugCaseEvidenceItem"("kind");

ALTER TABLE "DrugCaseEvidenceItem" ADD CONSTRAINT "DrugCaseEvidenceItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
