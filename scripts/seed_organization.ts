/**
 * Seeds the Region/Battalion/Company master hierarchy into Supabase
 * (Phase 20A). Idempotent — safe to re-run; each row is upserted by its
 * unique code, so a repeat run creates no duplicates.
 *
 * Usage:
 *   npx tsx scripts/seed_organization.ts
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const envFile of [".env.local", ".env"]) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

async function main() {
  const { createDatabaseClient } = await import("@/lib/database/database");
  const { createOrganizationContainer } = await import("@/lib/organization/organization_container");
  const { seedOrganization, ORGANIZATION_SEED } = await import("@/lib/organization/organization_seed");
  const client = createDatabaseClient();

  const { repository } = createOrganizationContainer(client as never);
  const summary = await seedOrganization(repository, ORGANIZATION_SEED);

  console.log(`Seeded ${summary.regions} regions, ${summary.battalions} battalions, ${summary.companies} companies.`);

  await client.$disconnect();
}

main().catch((error) => {
  console.error("Organization seed failed:", error);
  process.exit(1);
});
