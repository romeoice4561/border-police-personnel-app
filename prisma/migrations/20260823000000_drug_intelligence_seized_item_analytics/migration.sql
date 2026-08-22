-- Phase DI-3.1: canonical drug-category / measurement-kind analytics keys
-- on DrugSeizedItem. Additive-only. DrugSeizedItem had 0 rows at the time
-- of this migration (verified), so the two NOT NULL columns need no
-- default/backfill — every future row is created through the updated
-- Create Case form, which always supplies both.

-- CreateEnum
CREATE TYPE "DrugCategory" AS ENUM ('METHAMPHETAMINE_TABLET', 'CRYSTAL_METHAMPHETAMINE', 'HEROIN', 'KETAMINE', 'MDMA', 'COCAINE', 'OPIUM', 'CANNABIS', 'OTHER');

-- CreateEnum
CREATE TYPE "DrugMeasurementKind" AS ENUM ('COUNT', 'MASS');

-- AlterTable
ALTER TABLE "DrugSeizedItem" ADD COLUMN     "drugCategory" "DrugCategory" NOT NULL,
ADD COLUMN     "measurementKind" "DrugMeasurementKind" NOT NULL,
ADD COLUMN     "otherDrugCategoryLabel" TEXT;

-- CreateIndex
CREATE INDEX "DrugSeizedItem_drugCategory_idx" ON "DrugSeizedItem"("drugCategory");
