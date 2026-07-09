/**
 * Phase 24A — Master Data seed runner.
 *
 * Seeds the static V2 master reference data (regions, ranks, positions,
 * timeline types, asset types, document types) idempotently. Safe to run
 * repeatedly: every row is upserted by its stable `code`, so a second run
 * creates nothing.
 *
 * Requires DATABASE_URL (or DIRECT_URL) in .env.local. Does NOT touch any
 * existing table — only the additive master_* tables.
 *
 * Usage:
 *   npx prisma migrate deploy      # once, to create the master_* tables
 *   npx tsx scripts/seed_master_data.ts
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

import { createDatabaseClient, DatabaseConfigError } from "@/lib/database/database";
import type { MasterDataClient } from "@/lib/database/master_data_types";
import { seedMasterData } from "@/lib/database/master_data_seeder";

async function main(): Promise<void> {
  let client: MasterDataClient & { $disconnect?: () => Promise<void> };
  try {
    client = createDatabaseClient() as unknown as MasterDataClient & { $disconnect?: () => Promise<void> };
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  console.log("Seeding V2 master data (idempotent)...");
  const summary = await seedMasterData(client);

  for (const t of summary) {
    console.log(`  ${t.table}: ${t.created} created, ${t.updated} updated (${t.total} total)`);
  }
  console.log("Completed");

  await client.$disconnect?.();
}

main().catch((error) => {
  console.error("Master data seed runner crashed:", error);
  process.exitCode = 1;
});
