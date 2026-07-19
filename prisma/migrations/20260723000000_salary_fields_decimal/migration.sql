-- AlterTable: salary amounts support satang (2 decimal places).
-- Existing integer values cast safely (48200 → 48200.00).
ALTER TABLE "Officer" ALTER COLUMN "currentSalary" TYPE DECIMAL(12,2) USING "currentSalary"::DECIMAL(12,2);
ALTER TABLE "Officer" ALTER COLUMN "otherSpecialAllowances" TYPE DECIMAL(12,2) USING "otherSpecialAllowances"::DECIMAL(12,2);
ALTER TABLE "Officer" ALTER COLUMN "cooperativeMonthlyDeduction" TYPE DECIMAL(12,2) USING "cooperativeMonthlyDeduction"::DECIMAL(12,2);
ALTER TABLE "Officer" ALTER COLUMN "netSalary" TYPE DECIMAL(12,2) USING "netSalary"::DECIMAL(12,2);
