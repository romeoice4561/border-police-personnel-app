/**
 * Phase 45.1 — Personnel Master Data migration verification (read-only).
 *
 * Confirms the 11 columns added by
 * prisma/migrations/20260721000000_personnel_master_data_expansion/ exist
 * on the "Officer" table in whichever database DATABASE_URL points to. Runs
 * ONE query against information_schema.columns — never SELECT/INSERT/
 * UPDATE/DELETE on any application table, never a schema change. Safe to
 * run against production; it cannot modify data.
 *
 * This script is NOT executed as part of any automated test suite or CI
 * step in this phase — it is a manual verification tool for a human
 * operator to run after applying the migration (see
 * docs/PHASE_45_1_DEPLOYMENT_RUNBOOK.md, "Migration verification").
 *
 * Usage:
 *   npx tsx scripts/verify_personnel_master_data_migration.ts
 *
 * Requires DATABASE_URL (or DIRECT_URL) in .env.local, same as every other
 * script in this directory.
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

import { createDatabaseClient, DatabaseConfigError } from "@/lib/database/database";

const EXPECTED_COLUMNS = [
  "academyClass",
  "isGpfMember",
  "isPoliceFuneralWelfareMember",
  "isCooperativeMember",
  "cooperativeName",
  "salaryLevel",
  "currentSalaryStep",
  "currentSalary",
  "otherSpecialAllowances",
  "cooperativeMonthlyDeduction",
  "netSalary",
  "bankName",
  "bankAccountNumber",
] as const;

interface ColumnRow {
  column_name: string;
  is_nullable: string;
  data_type: string;
}

async function main(): Promise<void> {
  let client: { $queryRawUnsafe: (query: string) => Promise<unknown>; $disconnect?: () => Promise<void> };
  try {
    client = createDatabaseClient() as unknown as typeof client;
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      console.error("DATABASE_URL is not configured. Set it in .env.local before running this script.");
      process.exit(1);
    }
    throw error;
  }

  try {
    // information_schema is read-only metadata — this query cannot modify
    // any row or table.
    const rows = (await client.$queryRawUnsafe(
      `SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'Officer' ORDER BY column_name;`
    )) as ColumnRow[];

    const found = new Map(rows.map((r) => [r.column_name, r]));
    const missing = EXPECTED_COLUMNS.filter((col) => !found.has(col));
    const notNullable = EXPECTED_COLUMNS.filter((col) => found.get(col)?.is_nullable === "NO");

    console.log(`Checked ${EXPECTED_COLUMNS.length} expected Phase 45.1 columns on "Officer":\n`);
    for (const col of EXPECTED_COLUMNS) {
      const row = found.get(col);
      if (!row) {
        console.log(`  ✗ ${col} — MISSING (migration not applied, or applied against a different database)`);
      } else {
        console.log(`  ✓ ${col} — present (${row.data_type}, nullable=${row.is_nullable})`);
      }
    }

    if (missing.length > 0) {
      console.error(`\n${missing.length} column(s) missing. The migration has NOT been fully applied to this database.`);
      console.error("Run: npx prisma migrate deploy (see docs/PHASE_45_1_DEPLOYMENT_RUNBOOK.md)");
      process.exitCode = 1;
      return;
    }

    if (notNullable.length > 0) {
      console.error(`\n${notNullable.length} column(s) are unexpectedly NOT NULL: ${notNullable.join(", ")}.`);
      console.error("Phase 45.1's migration defines every new column as nullable — this indicates schema drift.");
      process.exitCode = 1;
      return;
    }

    console.log("\nAll 11 columns present and nullable. Migration verified successfully.");
  } finally {
    await client.$disconnect?.();
  }
}

main().catch((error) => {
  console.error("Verification failed:", error);
  process.exit(1);
});
