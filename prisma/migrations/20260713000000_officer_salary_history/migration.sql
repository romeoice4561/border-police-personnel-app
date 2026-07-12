-- Phase 28A: Career Intelligence Foundation (additive, non-destructive).
--
-- Adds:
--   1. SalaryHistory — one salary-step result (0.5/1.0/1.5/2.0) per officer
--      per Buddhist-Era year. Unique(officerId, yearBE) enforces exactly one
--      record per officer per year. Independent CRUD rows (same convention
--      as Education/Training) — historical years are preserved permanently;
--      the current year is always editable.
--   2. Officer.salaryHistory — the back-relation.
--
-- No existing table, column, or row is altered. This table is intentionally
-- minimal (foundation only) — no eligibility/warning/AI-suggestion columns
-- exist yet; future phases read this table rather than requiring schema
-- changes here.

CREATE TABLE "SalaryHistory" (
    "id" SERIAL NOT NULL,
    "officerId" INTEGER NOT NULL,
    "yearBE" INTEGER NOT NULL,
    "salaryStep" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalaryHistory_officerId_yearBE_key" ON "SalaryHistory"("officerId", "yearBE");
CREATE INDEX "SalaryHistory_officerId_idx" ON "SalaryHistory"("officerId");

ALTER TABLE "SalaryHistory" ADD CONSTRAINT "SalaryHistory_officerId_fkey"
    FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
