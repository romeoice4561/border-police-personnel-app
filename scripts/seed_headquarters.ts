/**
 * Seeds the Headquarters master table into Supabase (Phase 26B Part C/H),
 * and links the existing 4 "ภาค N" Region rows to บช.ตชด. (Border Patrol
 * Police headquarters) as their parent. Idempotent — safe to re-run; each
 * headquarters row is upserted by its unique code, and the Region link is
 * only ever set (never blanked) when a region is currently unlinked, so a
 * repeat run never overwrites a human's later choice.
 *
 * Usage:
 *   npx tsx scripts/seed_headquarters.ts
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
  const { HEADQUARTERS_DEFAULTS } = await import("@/lib/organization/headquarters_options");
  const client = createDatabaseClient() as unknown as {
    headquarters: {
      upsert(args: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<{ id: number; code: string }>;
    };
    region: {
      findMany(args: { where: Record<string, unknown> }): Promise<Array<{ id: number; code: string; headquartersId: number | null }>>;
      update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
    };
    $disconnect(): Promise<void>;
  };

  let created = 0;
  let updated = 0;
  let bpp: { id: number; code: string } | null = null;

  for (const entry of HEADQUARTERS_DEFAULTS) {
    const existing = await client.headquarters.upsert({
      where: { code: entry.code },
      create: { code: entry.code, nameTh: entry.nameTh, displayOrder: entry.displayOrder },
      update: { nameTh: entry.nameTh, displayOrder: entry.displayOrder },
    });
    if (entry.code === "BPP") bpp = existing;
    created += 1;
  }

  console.log(`Upserted ${created} headquarters rows.`);

  if (bpp) {
    const unlinkedRegions = await client.region.findMany({ where: { headquartersId: null } });
    for (const region of unlinkedRegions) {
      await client.region.update({ where: { id: region.id }, data: { headquartersId: bpp.id } });
      updated += 1;
    }
    console.log(`Linked ${updated} previously-unlinked region(s) to บช.ตชด. (headquartersId=${bpp.id}).`);
  }

  await client.$disconnect();
}

main().catch((error) => {
  console.error("Headquarters seed failed:", error);
  process.exit(1);
});
