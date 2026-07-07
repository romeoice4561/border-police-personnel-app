-- Phase 23A: Officer Profile Workspace Foundation (additive, non-destructive).
--
-- Adds:
--   1. Officer contact fields (email, lineId, facebookUrl) — nullable, flat
--      fields matching the existing phone/region style. No Contact table.
--   2. Timeline provenance/verification fields (source, verified) — nullable
--      source, verified defaults to the unverified status string so every
--      existing row is automatically "ยังไม่ตรวจ" with no backfill needed.
--   3. Education and Training tables — independent per-row CRUD entities,
--      each FK'd to Officer with ON DELETE CASCADE (mirrors Timeline/Phone).
--
-- No existing column renamed or dropped. No existing table's shape changed
-- beyond additive columns. Officer/Timeline/Phone/Asset/ProfilePhoto/
-- Region/Battalion/Company/Unit/ImportJob/ImportLog are otherwise untouched.

-- AlterTable: Officer contact fields
ALTER TABLE "Officer" ADD COLUMN "email" TEXT;
ALTER TABLE "Officer" ADD COLUMN "lineId" TEXT;
ALTER TABLE "Officer" ADD COLUMN "facebookUrl" TEXT;

-- AlterTable: Timeline per-row rank + provenance/verification fields
ALTER TABLE "Timeline" ADD COLUMN "rank" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "source" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "verified" TEXT NOT NULL DEFAULT 'ยังไม่ตรวจ';

-- CreateTable: Education
CREATE TABLE "Education" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "year" TEXT,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Education_officerId_idx" ON "Education"("officerId");

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Training
CREATE TABLE "Training" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "year" TEXT,
    "course" TEXT NOT NULL,
    "organization" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Training_officerId_idx" ON "Training"("officerId");

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
