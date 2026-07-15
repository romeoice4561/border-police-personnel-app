/**
 * Phase 44 — Skill catalog seed runner.
 *
 * Seeds the skill master data (categories, skills, levels) idempotently. Safe
 * to run repeatedly — every row is upserted by its stable `code`. Does NOT
 * touch any existing table — only the additive skill master tables.
 *
 * Usage:
 *   npx prisma migrate deploy      # once, to create the skill tables
 *   npx tsx scripts/seed_skills.ts
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

import { createDatabaseClient, DatabaseConfigError } from "@/lib/database/database";
import { seedSkillCatalog, type SkillSeederClient } from "@/lib/capability/skill_seeder";

async function main(): Promise<void> {
  let client: SkillSeederClient & { $disconnect?: () => Promise<void> };
  try {
    client = createDatabaseClient() as unknown as SkillSeederClient & { $disconnect?: () => Promise<void> };
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  console.log("Seeding skill catalog (idempotent)...");
  const summary = await seedSkillCatalog(client);

  for (const t of summary) {
    console.log(`  ${t.table}: ${t.created} created, ${t.updated} updated (${t.total} total)`);
  }
  console.log("Completed");

  await client.$disconnect?.();
}

main().catch((error) => {
  console.error("Skill seed runner crashed:", error);
  process.exitCode = 1;
});
