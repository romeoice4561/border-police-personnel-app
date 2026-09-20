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
import { DrugCrossCaseConnectionService } from "@/lib/drug_intelligence/drug_cross_case_connection_service";
import { DrugStatsService } from "@/lib/drug_intelligence/drug_stats_service";
import { DrugPersonMatchingService } from "@/lib/drug_intelligence/drug_person_matching_service";
import { DrugPersonMergeService } from "@/lib/drug_intelligence/drug_person_merge_service";
import { DrugPersonMatchReviewService } from "@/lib/drug_intelligence/drug_person_match_review_service";
import { DrugPersonProfileService, DrugPersonDirectoryService } from "@/lib/drug_intelligence/drug_person_profile_service";
import { DrugIntelligenceSearchService } from "@/lib/drug_intelligence/drug_intelligence_search_service";
import { DrugEntityDetailService } from "@/lib/drug_intelligence/drug_entity_detail_service";
import { DrugNetworkGraphService } from "@/lib/drug_intelligence/drug_network_graph_service";
import { DrugLinkCompareService } from "@/lib/drug_intelligence/drug_link_compare_service";
import { DrugIntelligenceRelationshipQueryService } from "@/lib/drug_intelligence/drug_intelligence_relationship_query_service";
import { DrugIntelligenceAlertService } from "@/lib/drug_intelligence/drug_intelligence_alert_service";
import { DrugTimelineService } from "@/lib/drug_intelligence/drug_timeline_service";
import { OfficerDrugArrestPerformanceService } from "@/lib/drug_intelligence/officer_drug_arrest_performance_service";
import { DrugGeoIntelligenceService } from "@/lib/drug_intelligence/drug_geo_intelligence_service";
import { DrugMapQueryService } from "@/lib/drug_intelligence/drug_map_query";
import { DrugMapCaseDetailService } from "@/lib/drug_intelligence/drug_map_case_detail";
import { DrugCommanderDashboardService } from "@/lib/drug_intelligence/drug_commander_dashboard_service";
import { DrugInvestigationBoardService } from "@/lib/drug_intelligence/drug_investigation_board_service";
import { DrugInvestigationBoardImageService } from "@/lib/drug_intelligence/drug_investigation_board_image_service";
import { DrugEntityMediaService } from "@/lib/drug_intelligence/drug_entity_media_service";
import { DrugAnalystNoteService } from "@/lib/drug_intelligence/drug_analyst_note_service";
import { DrugInvestigationTaskService } from "@/lib/drug_intelligence/drug_investigation_task_service";
import {
  resolveBoardImageStorageConfig,
  SupabaseBoardImageObjectStore,
  type BoardImageObjectStore,
} from "@/lib/drug_intelligence/drug_investigation_board_image_storage";

export interface DrugIntelligenceContainer {
  /** Raw DatabaseClient — passed to handlers that manage their own repositories directly (e.g. DI-7.2/7.3 network group/role handlers). */
  db: DatabaseClient;
  caseService: DrugCaseService;
  /** DI-8.2A: cross-case connection evidence (shared-entity fan-out). */
  crossCaseConnectionService: DrugCrossCaseConnectionService;
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
  /** Phase DI-5: Network Intelligence / Link Analysis. */
  networkGraphService: DrugNetworkGraphService;
  /** LC-2A: Link Compare read-only QUERY analysis. */
  linkCompareService: DrugLinkCompareService;
  /** Intelligence Search Center Phase 1B: Relationship Search orchestration. */
  relationshipQueryService: DrugIntelligenceRelationshipQueryService;
  /** Phase DI-6: Repeat Entity Detection & Intelligence Alerts. */
  alertService: DrugIntelligenceAlertService;
  /** Phase DI-7: Timeline & Geographic Intelligence. */
  timelineService: DrugTimelineService;
  /** Phase DI-7.7: Officer Drug-Arrest Performance read model — Officer Profile integration + future Commander Dashboard drill-down. */
  officerDrugArrestPerformanceService: OfficerDrugArrestPerformanceService;
  /** Phase DI-8: Geographic / Map Intelligence read model (legacy, unused by live Map GET). */
  geoIntelligenceService: DrugGeoIntelligenceService;
  /** DI-10E.6B: bounded live Map V2 query. */
  mapQueryService: DrugMapQueryService;
  /** DI-10E.6C: one-case Map popup detail. */
  mapCaseDetailService: DrugMapCaseDetailService;
  /** Phase 2B: Commander Intelligence Dashboard read model. */
  commanderDashboardService: DrugCommanderDashboardService;
  /** Phase DI-9.5B: Saved Investigation Boards. */
  investigationBoardService: DrugInvestigationBoardService;
  /** Phase DI-9.5D: private board images. Null when storage is not configured. */
  investigationBoardImageService: DrugInvestigationBoardImageService | null;
  /** Entity Media / Visual Identity. Null when storage is not configured. */
  entityMediaService: DrugEntityMediaService | null;
  /** DI-11B: collaboration foundation — no UI. */
  analystNoteService: DrugAnalystNoteService;
  investigationTaskService: DrugInvestigationTaskService;
}

/** Builds the container from any DatabaseClient (real or fake). Pure — no I/O. */
export function createDrugIntelligenceContainer(
  client: DatabaseClient,
  imageStore?: BoardImageObjectStore | null
): DrugIntelligenceContainer {
  const investigationBoardImageService = imageStore
    ? new DrugInvestigationBoardImageService(client, imageStore)
    : null;
  const entityMediaService = imageStore ? new DrugEntityMediaService(client, imageStore) : null;
  const networkGraphService = new DrugNetworkGraphService(client);
  return {
    db: client,
    caseService: new DrugCaseService({ db: client }),
    crossCaseConnectionService: new DrugCrossCaseConnectionService(client),
    statsService: new DrugStatsService(client),
    matchingService: new DrugPersonMatchingService(client),
    mergeService: new DrugPersonMergeService(client),
    matchReviewService: new DrugPersonMatchReviewService(client),
    profileService: new DrugPersonProfileService(client),
    directoryService: new DrugPersonDirectoryService(client),
    searchService: new DrugIntelligenceSearchService(client),
    entityDetailService: new DrugEntityDetailService(client),
    networkGraphService,
    linkCompareService: new DrugLinkCompareService(client, networkGraphService),
    relationshipQueryService: new DrugIntelligenceRelationshipQueryService(client),
    alertService: new DrugIntelligenceAlertService(client),
    timelineService: new DrugTimelineService(client),
    officerDrugArrestPerformanceService: new OfficerDrugArrestPerformanceService({ db: client }),
    geoIntelligenceService: new DrugGeoIntelligenceService({ db: client }),
    mapQueryService: new DrugMapQueryService(client),
    mapCaseDetailService: new DrugMapCaseDetailService(client),
    commanderDashboardService: new DrugCommanderDashboardService(client),
    investigationBoardService: new DrugInvestigationBoardService(client, investigationBoardImageService ?? undefined),
    investigationBoardImageService,
    entityMediaService,
    analystNoteService: new DrugAnalystNoteService(client),
    investigationTaskService: new DrugInvestigationTaskService(client),
  };
}

let cachedClient: DatabaseClient | undefined;

/** Lazily builds (once per process) the production container backed by the real Prisma client. */
export async function getDrugIntelligenceContainer(): Promise<DrugIntelligenceContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as DatabaseClient;
  }
  const config = resolveBoardImageStorageConfig();
  const store = config ? new SupabaseBoardImageObjectStore(config) : null;
  return createDrugIntelligenceContainer(cachedClient, store);
}
