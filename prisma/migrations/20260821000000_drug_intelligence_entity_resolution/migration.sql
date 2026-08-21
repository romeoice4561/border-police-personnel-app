-- CreateEnum
CREATE TYPE "DrugPersonStatus" AS ENUM ('ACTIVE', 'MERGED');

-- CreateEnum
CREATE TYPE "DrugPersonMatchDecision" AS ENUM ('CONFIRMED_DUPLICATE', 'NOT_SAME', 'MERGED');

-- AlterTable
ALTER TABLE "DrugPerson" ADD COLUMN     "mergedIntoPersonId" TEXT,
ADD COLUMN     "status" "DrugPersonStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "DrugPersonMatchReview" (
    "id" TEXT NOT NULL,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "decision" "DrugPersonMatchDecision" NOT NULL,
    "signals" JSONB NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedByName" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "DrugPersonMatchReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPersonMerge" (
    "id" TEXT NOT NULL,
    "survivorPersonId" TEXT NOT NULL,
    "mergedPersonId" TEXT NOT NULL,
    "reason" TEXT,
    "detail" JSONB NOT NULL,
    "mergedBy" TEXT NOT NULL,
    "mergedByName" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugPersonMerge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugPersonMatchReview_personAId_idx" ON "DrugPersonMatchReview"("personAId");

-- CreateIndex
CREATE INDEX "DrugPersonMatchReview_personBId_idx" ON "DrugPersonMatchReview"("personBId");

-- CreateIndex
CREATE INDEX "DrugPersonMatchReview_decision_idx" ON "DrugPersonMatchReview"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "DrugPersonMatchReview_personAId_personBId_key" ON "DrugPersonMatchReview"("personAId", "personBId");

-- CreateIndex
CREATE INDEX "DrugPersonMerge_survivorPersonId_idx" ON "DrugPersonMerge"("survivorPersonId");

-- CreateIndex
CREATE INDEX "DrugPersonMerge_mergedPersonId_idx" ON "DrugPersonMerge"("mergedPersonId");

-- CreateIndex
CREATE INDEX "DrugPersonMerge_mergedAt_idx" ON "DrugPersonMerge"("mergedAt");

-- CreateIndex
CREATE INDEX "DrugPerson_status_idx" ON "DrugPerson"("status");

-- CreateIndex
CREATE INDEX "DrugPerson_mergedIntoPersonId_idx" ON "DrugPerson"("mergedIntoPersonId");

-- AddForeignKey
ALTER TABLE "DrugPerson" ADD CONSTRAINT "DrugPerson_mergedIntoPersonId_fkey" FOREIGN KEY ("mergedIntoPersonId") REFERENCES "DrugPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonMatchReview" ADD CONSTRAINT "DrugPersonMatchReview_personAId_fkey" FOREIGN KEY ("personAId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonMatchReview" ADD CONSTRAINT "DrugPersonMatchReview_personBId_fkey" FOREIGN KEY ("personBId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonMerge" ADD CONSTRAINT "DrugPersonMerge_survivorPersonId_fkey" FOREIGN KEY ("survivorPersonId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPersonMerge" ADD CONSTRAINT "DrugPersonMerge_mergedPersonId_fkey" FOREIGN KEY ("mergedPersonId") REFERENCES "DrugPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
