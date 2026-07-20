-- AlterTable
ALTER TABLE "OfficerDocument" ADD COLUMN "issueDate" DATE,
ADD COLUMN "expiryDate" DATE,
ADD COLUMN "renewalDate" DATE;

-- CreateIndex
CREATE INDEX "OfficerDocument_expiryDate_idx" ON "OfficerDocument"("expiryDate");
