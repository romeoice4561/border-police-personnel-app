-- Phase 26B Part 5: Officer personal information + Timeline verification
-- triad (additive, non-destructive).
--
-- Adds:
--   1. Officer.nickname — shown alongside Phone/Email/LINE/Facebook (Part
--      C/I), not a separate section.
--   2. Officer personal-information fields (Part G): dateOfBirth (real
--      DATE), bloodGroup, rh, maritalStatus, children, homeProvince,
--      shirtSize, nationality.
--   3. Officer optional fields (Part O): citizenId, passportNumber,
--      employeeNumber, emergencyContact, emergencyPhone, addressSummary,
--      currentProvince, religion, educationLevel, weightKg, heightCm,
--      uniformShoeSize, hatSize, jacketSize. retirementYear/countdown/BMI
--      are intentionally NOT columns — Part O labels them "Auto
--      Calculated", so they are derived at read time, never persisted.
--   4. Timeline verification triad (Part D/H/M): verificationStatus (new
--      4-value closed set, distinct from the existing `verified` free-text
--      column, which is untouched), verifiedBy, verifiedDate,
--      verificationRemark.
--
-- No existing column altered or dropped. No row deleted. No Phase 25 data
-- touched. No backfill — every existing Officer/Timeline row simply has
-- these new columns NULL until explicitly set via the new UI (same
-- convention as every prior Phase 26 additive migration).

-- Officer.nickname (Part C/I)
ALTER TABLE "Officer" ADD COLUMN "nickname" TEXT;

-- Officer personal information (Part G)
ALTER TABLE "Officer" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "Officer" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "Officer" ADD COLUMN "rh" TEXT;
ALTER TABLE "Officer" ADD COLUMN "maritalStatus" TEXT;
ALTER TABLE "Officer" ADD COLUMN "children" INTEGER;
ALTER TABLE "Officer" ADD COLUMN "homeProvince" TEXT;
ALTER TABLE "Officer" ADD COLUMN "shirtSize" TEXT;
ALTER TABLE "Officer" ADD COLUMN "nationality" TEXT;

-- Officer optional fields (Part O)
ALTER TABLE "Officer" ADD COLUMN "citizenId" TEXT;
ALTER TABLE "Officer" ADD COLUMN "passportNumber" TEXT;
ALTER TABLE "Officer" ADD COLUMN "employeeNumber" TEXT;
ALTER TABLE "Officer" ADD COLUMN "emergencyContact" TEXT;
ALTER TABLE "Officer" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "Officer" ADD COLUMN "addressSummary" TEXT;
ALTER TABLE "Officer" ADD COLUMN "currentProvince" TEXT;
ALTER TABLE "Officer" ADD COLUMN "religion" TEXT;
ALTER TABLE "Officer" ADD COLUMN "educationLevel" TEXT;
ALTER TABLE "Officer" ADD COLUMN "weightKg" DOUBLE PRECISION;
ALTER TABLE "Officer" ADD COLUMN "heightCm" DOUBLE PRECISION;
ALTER TABLE "Officer" ADD COLUMN "uniformShoeSize" TEXT;
ALTER TABLE "Officer" ADD COLUMN "hatSize" TEXT;
ALTER TABLE "Officer" ADD COLUMN "jacketSize" TEXT;

-- Timeline verification triad (Part D/H/M)
ALTER TABLE "Timeline" ADD COLUMN "verificationStatus" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "Timeline" ADD COLUMN "verifiedDate" DATE;
ALTER TABLE "Timeline" ADD COLUMN "verificationRemark" TEXT;

CREATE INDEX "Timeline_verificationStatus_idx" ON "Timeline"("verificationStatus");
