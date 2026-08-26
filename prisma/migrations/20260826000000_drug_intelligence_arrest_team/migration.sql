-- CreateEnum
CREATE TYPE "DrugCaseUnitRole" AS ENUM ('LEAD', 'PARTICIPATING', 'INVESTIGATION_SUPPORT', 'INTELLIGENCE_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "DrugCaseOfficerRole" AS ENUM ('ARREST_TEAM_LEAD', 'ARRESTING_OFFICER', 'INVESTIGATOR', 'INTELLIGENCE_OFFICER', 'CASE_COORDINATOR', 'EVIDENCE_OFFICER', 'SUPPORT', 'OTHER');

-- AlterTable
ALTER TABLE "DrugCase" ADD COLUMN     "leadBattalionId" INTEGER,
ADD COLUMN     "leadCompanyId" INTEGER,
ADD COLUMN     "leadHeadquartersId" INTEGER,
ADD COLUMN     "leadRegionId" INTEGER,
ADD COLUMN     "leadUnitManualText" TEXT;

-- CreateTable
CREATE TABLE "DrugCaseParticipatingUnit" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "headquartersId" INTEGER,
    "regionId" INTEGER,
    "battalionId" INTEGER,
    "companyId" INTEGER,
    "manualUnitText" TEXT,
    "role" "DrugCaseUnitRole" NOT NULL DEFAULT 'PARTICIPATING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,

    CONSTRAINT "DrugCaseParticipatingUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugCaseOfficer" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "officerId" TEXT,
    "manualRank" TEXT,
    "manualFullName" TEXT,
    "manualPosition" TEXT,
    "manualUnitText" TEXT,
    "role" "DrugCaseOfficerRole" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,

    CONSTRAINT "DrugCaseOfficer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrugCaseParticipatingUnit_caseId_idx" ON "DrugCaseParticipatingUnit"("caseId");

-- CreateIndex
CREATE INDEX "DrugCaseParticipatingUnit_headquartersId_idx" ON "DrugCaseParticipatingUnit"("headquartersId");

-- CreateIndex
CREATE INDEX "DrugCaseParticipatingUnit_regionId_idx" ON "DrugCaseParticipatingUnit"("regionId");

-- CreateIndex
CREATE INDEX "DrugCaseParticipatingUnit_battalionId_idx" ON "DrugCaseParticipatingUnit"("battalionId");

-- CreateIndex
CREATE INDEX "DrugCaseParticipatingUnit_companyId_idx" ON "DrugCaseParticipatingUnit"("companyId");

-- CreateIndex
CREATE INDEX "DrugCaseOfficer_caseId_idx" ON "DrugCaseOfficer"("caseId");

-- CreateIndex
CREATE INDEX "DrugCaseOfficer_officerId_idx" ON "DrugCaseOfficer"("officerId");

-- CreateIndex
CREATE UNIQUE INDEX "DrugCaseOfficer_caseId_officerId_role_key" ON "DrugCaseOfficer"("caseId", "officerId", "role");

-- CreateIndex
CREATE INDEX "DrugCase_leadHeadquartersId_idx" ON "DrugCase"("leadHeadquartersId");

-- CreateIndex
CREATE INDEX "DrugCase_leadRegionId_idx" ON "DrugCase"("leadRegionId");

-- CreateIndex
CREATE INDEX "DrugCase_leadBattalionId_idx" ON "DrugCase"("leadBattalionId");

-- CreateIndex
CREATE INDEX "DrugCase_leadCompanyId_idx" ON "DrugCase"("leadCompanyId");

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_leadHeadquartersId_fkey" FOREIGN KEY ("leadHeadquartersId") REFERENCES "Headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_leadRegionId_fkey" FOREIGN KEY ("leadRegionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_leadBattalionId_fkey" FOREIGN KEY ("leadBattalionId") REFERENCES "Battalion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCase" ADD CONSTRAINT "DrugCase_leadCompanyId_fkey" FOREIGN KEY ("leadCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseParticipatingUnit" ADD CONSTRAINT "DrugCaseParticipatingUnit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseParticipatingUnit" ADD CONSTRAINT "DrugCaseParticipatingUnit_headquartersId_fkey" FOREIGN KEY ("headquartersId") REFERENCES "Headquarters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseParticipatingUnit" ADD CONSTRAINT "DrugCaseParticipatingUnit_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseParticipatingUnit" ADD CONSTRAINT "DrugCaseParticipatingUnit_battalionId_fkey" FOREIGN KEY ("battalionId") REFERENCES "Battalion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseParticipatingUnit" ADD CONSTRAINT "DrugCaseParticipatingUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugCaseOfficer" ADD CONSTRAINT "DrugCaseOfficer_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DrugCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
