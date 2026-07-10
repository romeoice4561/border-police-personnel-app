/**
 * API dependency container (Phase 13).
 *
 * Assembles the read-only query repositories the route handlers depend on,
 * over an injected ReadDatabaseClient. This is the single dependency-injection
 * seam: route handlers call `getApiContainer()` (backed by the real Prisma
 * client) in production, while tests construct `createApiContainer(fakeClient)`
 * directly — no route handler ever touches Prisma or SQL directly.
 *
 * The production client is created once per process and reused across requests
 * (a per-process cache is standard for serverless/Next route handlers and is
 * NOT a global singleton exported as shared mutable state — it is an internal
 * lazy holder that createApiContainer never depends on).
 */

import type { ReadDatabaseClient } from "@/lib/database/query_types";
import { OfficerQueryRepository } from "@/lib/database/repositories/officer_query_repository";
import { UnitQueryRepository } from "@/lib/database/repositories/unit_query_repository";
import { RankQueryRepository } from "@/lib/database/repositories/rank_query_repository";
import { StatisticsQueryRepository } from "@/lib/database/repositories/statistics_query_repository";
import { GlobalSearchService } from "@/lib/search/global_search_service";
import type { SearchProvider } from "@/lib/search/global_search_types";
import type { ResolvedOfficerPortrait } from "@/lib/server/officer_portrait_service";

/**
 * Phase 24B-3: the portrait capability the officer list/search handlers use
 * to attach thumbnails to a page of results. Batch-only (never N+1) — see
 * lib/server/officer_portrait_service.ts, the single sanctioned resolver.
 * Injectable so handler tests can supply a fake without touching the DB.
 */
export interface PortraitBatchResolver {
  resolveBatch(officerIds: readonly string[]): Promise<Map<string, ResolvedOfficerPortrait>>;
}

export interface ApiContainer {
  officers: OfficerQueryRepository;
  units: UnitQueryRepository;
  ranks: RankQueryRepository;
  statistics: StatisticsQueryRepository;
  portraits: PortraitBatchResolver;
  /** Phase 26B Part B: multi-provider free-text search across Officer fields + Drive filenames (+ future document titles/GP7). */
  globalSearch: GlobalSearchService;
}

/**
 * Builds the container from any ReadDatabaseClient (real or fake) + a
 * portrait resolver. `searchProviders` (Phase 26B Part B) is optional so
 * every pre-existing caller/test is unaffected — global search simply has
 * no extra providers (Officer-field search still works) until one is
 * supplied. Pure — no I/O.
 */
export function createApiContainer(
  client: ReadDatabaseClient,
  portraits: PortraitBatchResolver,
  searchProviders: readonly SearchProvider[] = []
): ApiContainer {
  const officers = new OfficerQueryRepository(client);
  return {
    officers,
    units: new UnitQueryRepository(client),
    ranks: new RankQueryRepository(client),
    statistics: new StatisticsQueryRepository(client),
    portraits,
    globalSearch: new GlobalSearchService({ officers, providers: searchProviders }),
  };
}

/**
 * Lazily creates (once per process) the production container backed by the
 * real Prisma client via the Phase 12 database factory, and the real
 * resolveOfficerPortraitsBatch (the one sanctioned batch resolver). Imported
 * dynamically so this module — and the query repositories/tests — never pull
 * the Prisma runtime unless a real request needs it.
 */
let cachedClient: ReadDatabaseClient | undefined;

export async function getApiContainer(): Promise<ApiContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as ReadDatabaseClient;
  }
  const { resolveOfficerPortraitsBatch } = await import("@/lib/server/officer_portrait_service");
  // Phase 26B Part B: Drive filename is a first-class Global Search provider,
  // reusing the existing ProfilePhotoService (no denormalization — the join
  // stays through ProfilePhoto.matchedOfficerId exactly as before).
  const { getProfilePhotoContainer } = await import("@/lib/profile_photo/profile_photo_container");
  const { DriveFilenameSearchProvider } = await import("@/lib/search/drive_filename_provider");
  const { service: profilePhotoService } = await getProfilePhotoContainer();
  return createApiContainer(cachedClient, { resolveBatch: resolveOfficerPortraitsBatch }, [
    new DriveFilenameSearchProvider(profilePhotoService),
  ]);
}
