-- Phase 45.1: Personnel Master Data Expansion (additive, non-destructive).
--
-- Adds the previously-deferred Phase 40A Master Data fields:
--   1. Police Cadet Academy Class (academyClass) — integer 40-100, validated
--      at the API layer (Zod), never a DB CHECK constraint (matches this
--      schema's existing convention for range-validated fields).
--   2. Membership tri-state fields (isGpfMember, isPoliceFuneralWelfareMember,
--      isCooperativeMember) — nullable Boolean so legacy "unknown" data stays
--      NULL and is never coerced to false. cooperativeName is free text.
--   3. Salary Master Data (salaryLevel, currentSalaryStep, currentSalary,
--      netSalary) — factual current-state fields, DISTINCT from the existing
--      SalaryHistory table (which tracks yearly step history for Salary
--      Intelligence's "2 ขั้น" eligibility calculation). No Intelligence
--      calculation reads or writes these columns in this phase.
--   4. Bank fields (bankName, bankAccountNumber) — bankAccountNumber is TEXT
--      (never numeric) so leading zeros are preserved exactly as entered.
--
-- No existing column altered or dropped. No row deleted. No backfill —
-- every existing Officer row simply has these new columns NULL until
-- explicitly set via the new "ข้อมูลสมาชิกและการเงิน" editor section.

ALTER TABLE "Officer" ADD COLUMN "academyClass" INTEGER;
ALTER TABLE "Officer" ADD COLUMN "isGpfMember" BOOLEAN;
ALTER TABLE "Officer" ADD COLUMN "isPoliceFuneralWelfareMember" BOOLEAN;
ALTER TABLE "Officer" ADD COLUMN "isCooperativeMember" BOOLEAN;
ALTER TABLE "Officer" ADD COLUMN "cooperativeName" TEXT;
ALTER TABLE "Officer" ADD COLUMN "salaryLevel" TEXT;
ALTER TABLE "Officer" ADD COLUMN "currentSalaryStep" TEXT;
ALTER TABLE "Officer" ADD COLUMN "currentSalary" INTEGER;
ALTER TABLE "Officer" ADD COLUMN "netSalary" INTEGER;
ALTER TABLE "Officer" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Officer" ADD COLUMN "bankAccountNumber" TEXT;
