/**
 * Drug Intelligence dependency container (Phase DI-1).
 *
 * Mirrors every other module's DI seam in this codebase exactly:
 *   - `createDrugIntelligenceContainer(client)` builds the graph from any
 *     DatabaseClient (the real Prisma client in production, a fake in tests).
 *   - `getDrugIntelligenceContainer()` lazily creates the production graph
 *     backed by the real Supabase-connected Prisma client, reused per
 *     process — the SAME client every other module uses (no second
 *     database, no second connection — see the schema's module-header
 *     comment).
 */

import type { DatabaseClient } from "@/lib/database/database_types";
import { DrugCaseService } from "@/lib/drug_intelligence/drug_case_service";
import { DrugStatsService } from "@/lib/drug_intelligence/drug_stats_service";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugPersonMatchReviewService } from "@/lib/drug_intelligence/drug_person_match_review_service";
import { DrugPersonProfileService, DrugPersonDirectoryService } from "@/lib/drug_intelligence/drug_person_profile_service";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import { DrugEntityDetailService } from "@/lib/drug_intelligence/drug_entity_detail_service";

export interface DrugIntelligenceContainer {
  caseService: DrugCaseService;
  statsService: DrugStatsService;
  /** Phase DI-2: Entity Resolution / Duplicate Matching services. */
  matchingService: DrugPersonMatchingService;
  mergeService: DrugPersonMergeService;
  matchReviewService: DrugPersonMatchReviewService;
  profileService: DrugPersonProfileService;
  directoryService: DrugPersonDirectoryService;
  /** Phase DI-3: Global Intelligence Search. */
  searchService: DrugIntelligenceSearchService;
  entityDetailService: DrugEntityDetailService;
}

/** Builds the container from any DatabaseClient (real or fake). Pure — no I/O. */
export function createDrugIntelligenceContainer(client: DatabaseClient): DrugIntelligenceContainer {
  return {
    caseService: new DrugCaseService({ db: client }),
    statsService: new DrugStatsService(client),
    matchingService: new DrugPersonMatchingService(client),
    mergeService: new DrugPersonMergeService(client),
    matchReviewService: new DrugPersonMatchReviewService(client),
    profileService: new DrugPersonProfileService(client),
    directoryService: new DrugPersonDirectoryService(client),
    searchService: new DrugIntelligenceSearchService(client),
    entityDetailService: new DrugEntityDetailService(client),
  };
}

let cachedClient: DatabaseClient | undefined;

/** Lazily builds (once per process) the production container backed by the real Prisma client. */
export async function getDrugIntelligenceContainer(): Promise<DrugIntelligenceContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as DatabaseClient;
  }
  return createDrugIntelligenceContainer(cachedClient);
}
