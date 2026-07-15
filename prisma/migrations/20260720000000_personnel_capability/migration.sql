-- Phase 44: Personnel Capability Intelligence (additive, non-destructive).
--
-- Adds the skills/competencies registry: three master tables (SkillCategory,
-- Skill, SkillLevel), the per-officer join (OfficerSkill), and a
-- forward-compatible per-skill certificate child table
-- (OfficerSkillCertificate). OfficerSkill.officerId FKs to the legacy
-- Officer.id (Int) with ON DELETE CASCADE, matching every existing officer
-- relation. No existing table, column, or index is altered.

CREATE TABLE "SkillCategory" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkillCategory_code_key" ON "SkillCategory"("code");
CREATE INDEX "SkillCategory_sortOrder_idx" ON "SkillCategory"("sortOrder");
CREATE INDEX "SkillCategory_active_idx" ON "SkillCategory"("active");

CREATE TABLE "Skill" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "searchableKeywords" TEXT NOT NULL DEFAULT '',
    "requiresCertificate" BOOLEAN NOT NULL DEFAULT false,
    "hasExpiry" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Skill_code_key" ON "Skill"("code");
CREATE INDEX "Skill_categoryId_idx" ON "Skill"("categoryId");
CREATE INDEX "Skill_active_idx" ON "Skill"("active");
CREATE INDEX "Skill_sortOrder_idx" ON "Skill"("sortOrder");

CREATE TABLE "SkillLevel" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkillLevel_code_key" ON "SkillLevel"("code");
CREATE UNIQUE INDEX "SkillLevel_rank_key" ON "SkillLevel"("rank");
CREATE INDEX "SkillLevel_rank_idx" ON "SkillLevel"("rank");

CREATE TABLE "OfficerSkill" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "skillId" INTEGER NOT NULL,
    "levelId" INTEGER,
    "yearsExperience" INTEGER,
    "certificateNumber" TEXT,
    "issuingOrganization" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedDate" DATE,
    "availableForDeployment" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerSkill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfficerSkill_officerId_skillId_key" ON "OfficerSkill"("officerId", "skillId");
CREATE INDEX "OfficerSkill_officerId_idx" ON "OfficerSkill"("officerId");
CREATE INDEX "OfficerSkill_skillId_idx" ON "OfficerSkill"("skillId");
CREATE INDEX "OfficerSkill_levelId_idx" ON "OfficerSkill"("levelId");
CREATE INDEX "OfficerSkill_verified_idx" ON "OfficerSkill"("verified");
CREATE INDEX "OfficerSkill_availableForDeployment_idx" ON "OfficerSkill"("availableForDeployment");
CREATE INDEX "OfficerSkill_expiryDate_idx" ON "OfficerSkill"("expiryDate");

CREATE TABLE "OfficerSkillCertificate" (
    "id" SERIAL NOT NULL,
    "officerSkillId" INTEGER NOT NULL,
    "certificateNumber" TEXT,
    "issuingOrganization" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerSkillCertificate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfficerSkillCertificate_officerSkillId_idx" ON "OfficerSkillCertificate"("officerSkillId");
CREATE INDEX "OfficerSkillCertificate_expiryDate_idx" ON "OfficerSkillCertificate"("expiryDate");

ALTER TABLE "Skill" ADD CONSTRAINT "Skill_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "SkillCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficerSkill" ADD CONSTRAINT "OfficerSkill_officerId_fkey"
    FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficerSkill" ADD CONSTRAINT "OfficerSkill_skillId_fkey"
    FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficerSkill" ADD CONSTRAINT "OfficerSkill_levelId_fkey"
    FOREIGN KEY ("levelId") REFERENCES "SkillLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficerSkillCertificate" ADD CONSTRAINT "OfficerSkillCertificate_officerSkillId_fkey"
    FOREIGN KEY ("officerSkillId") REFERENCES "OfficerSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
