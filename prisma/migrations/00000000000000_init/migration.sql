-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Officer" (
    "id" SERIAL NOT NULL,
    "officerId" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "currentPosition" TEXT,
    "currentUnit" TEXT,
    "phone" TEXT,
    "careerYears" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "knowledgeScore" INTEGER,
    "region" TEXT,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Officer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timeline" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "year" TEXT NOT NULL,
    "yearValue" INTEGER,
    "position" TEXT NOT NULL,
    "unit" TEXT,

    CONSTRAINT "Timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "officerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phone" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,

    CONSTRAINT "Phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "images" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "officerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Officer_officerId_key" ON "Officer"("officerId");

-- CreateIndex
CREATE INDEX "Officer_rank_idx" ON "Officer"("rank");

-- CreateIndex
CREATE INDEX "Officer_currentUnit_idx" ON "Officer"("currentUnit");

-- CreateIndex
CREATE INDEX "Officer_phone_idx" ON "Officer"("phone");

-- CreateIndex
CREATE INDEX "Officer_lastName_idx" ON "Officer"("lastName");

-- CreateIndex
CREATE INDEX "Timeline_yearValue_idx" ON "Timeline"("yearValue");

-- CreateIndex
CREATE INDEX "Timeline_unit_idx" ON "Timeline"("unit");

-- CreateIndex
CREATE UNIQUE INDEX "Timeline_officerId_sequence_key" ON "Timeline"("officerId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_name_key" ON "Unit"("name");

-- CreateIndex
CREATE INDEX "Unit_name_idx" ON "Unit"("name");

-- CreateIndex
CREATE INDEX "Phone_number_idx" ON "Phone"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Phone_officerId_number_key" ON "Phone"("officerId", "number");

-- CreateIndex
CREATE INDEX "ImportLog_jobId_idx" ON "ImportLog"("jobId");

-- CreateIndex
CREATE INDEX "ImportLog_officerId_idx" ON "ImportLog"("officerId");

-- AddForeignKey
ALTER TABLE "Timeline" ADD CONSTRAINT "Timeline_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phone" ADD CONSTRAINT "Phone_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
