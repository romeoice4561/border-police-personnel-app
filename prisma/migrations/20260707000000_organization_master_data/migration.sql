-- Phase 20A: Border Patrol Organization master data (additive, non-destructive).
--
-- Creates the authoritative Region -> Battalion -> Company hierarchy plus an
-- UnresolvedOrganizationCode review queue. No changes to Officer/Timeline/
-- Phone/Unit/Asset/ImportJob/ImportLog. Region/Battalion/Company codes are
-- unique (idempotent upsert keys); ON DELETE RESTRICT so a Region/Battalion
-- can never be removed while children still reference it.

-- CreateTable
CREATE TABLE "Region" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battalion" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "regionId" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battalion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "battalionId" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnresolvedOrganizationCode" (
    "id" SERIAL NOT NULL,
    "raw" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnresolvedOrganizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Battalion_code_key" ON "Battalion"("code");

-- CreateIndex
CREATE INDEX "Battalion_regionId_idx" ON "Battalion"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_battalionId_idx" ON "Company"("battalionId");

-- CreateIndex
CREATE INDEX "UnresolvedOrganizationCode_sourceModule_idx" ON "UnresolvedOrganizationCode"("sourceModule");

-- AddForeignKey
ALTER TABLE "Battalion" ADD CONSTRAINT "Battalion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_battalionId_fkey" FOREIGN KEY ("battalionId") REFERENCES "Battalion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
