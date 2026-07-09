/**
 * Master Data seeder (Phase 24A — Database V2 Foundation).
 *
 * Idempotently seeds the static V2 master reference data (regions, ranks,
 * positions, timeline types, asset types, document types) via the master-data
 * repositories' `upsertByCode`. Running it twice never creates a duplicate —
 * each row is keyed on its stable `code`.
 *
 * Injected MasterDataClient (no globals) so it runs against the real Prisma
 * client in the seed script and an in-memory fake in tests. The large
 * organization tree (commands / subdivisions / companies) is intentionally NOT
 * seeded here — that data comes from real source records in a later dedicated
 * migration phase, never invented.
 */

import type { MasterDataClient } from "@/lib/database/master_data_types";
import { createMasterDataRepositories } from "@/lib/database/repositories/master_data_repositories";
import {
  SEED_REGIONS,
  SEED_RANKS,
  SEED_POSITIONS,
  SEED_TIMELINE_TYPES,
  SEED_ASSET_TYPES,
  SEED_DOCUMENT_TYPES,
} from "@/lib/database/master_data_seed";

export interface SeedTableResult {
  table: string;
  created: number;
  updated: number;
  total: number;
}

export type SeedSummary = SeedTableResult[];

/** Upserts every row in `inputs`, tallying created vs. updated. */
async function seedTable<TInput>(
  table: string,
  inputs: TInput[],
  upsert: (input: TInput) => Promise<{ created: boolean }>,
): Promise<SeedTableResult> {
  let created = 0;
  let updated = 0;
  for (const input of inputs) {
    const { created: wasCreated } = await upsert(input);
    if (wasCreated) created += 1;
    else updated += 1;
  }
  return { table, created, updated, total: inputs.length };
}

/**
 * Seeds all static master data idempotently. Returns a per-table summary of
 * created vs. updated rows (a second run reports all `updated`, zero `created`).
 */
export async function seedMasterData(db: MasterDataClient): Promise<SeedSummary> {
  const repos = createMasterDataRepositories(db);
  return [
    await seedTable("master_regions", SEED_REGIONS, (i) => repos.regions.upsertByCode(i)),
    await seedTable("master_ranks", SEED_RANKS, (i) => repos.ranks.upsertByCode(i)),
    await seedTable("master_positions", SEED_POSITIONS, (i) => repos.positions.upsertByCode(i)),
    await seedTable("master_timeline_types", SEED_TIMELINE_TYPES, (i) => repos.timelineTypes.upsertByCode(i)),
    await seedTable("master_asset_types", SEED_ASSET_TYPES, (i) => repos.assetTypes.upsertByCode(i)),
    await seedTable("master_document_types", SEED_DOCUMENT_TYPES, (i) => repos.documentTypes.upsertByCode(i)),
  ];
}
