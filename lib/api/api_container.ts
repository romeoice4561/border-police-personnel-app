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

export interface ApiContainer {
  officers: OfficerQueryRepository;
  units: UnitQueryRepository;
  ranks: RankQueryRepository;
  statistics: StatisticsQueryRepository;
}

/** Builds the container from any ReadDatabaseClient (real or fake). Pure — no I/O. */
export function createApiContainer(client: ReadDatabaseClient): ApiContainer {
  return {
    officers: new OfficerQueryRepository(client),
    units: new UnitQueryRepository(client),
    ranks: new RankQueryRepository(client),
    statistics: new StatisticsQueryRepository(client),
  };
}

/**
 * Lazily creates (once per process) the production container backed by the
 * real Prisma client via the Phase 12 database factory. Imported dynamically
 * so this module — and the query repositories/tests — never pull the Prisma
 * runtime unless a real request needs it.
 */
let cachedClient: ReadDatabaseClient | undefined;

export async function getApiContainer(): Promise<ApiContainer> {
  if (!cachedClient) {
    const { createDatabaseClient } = await import("@/lib/database/database");
    cachedClient = createDatabaseClient() as unknown as ReadDatabaseClient;
  }
  return createApiContainer(cachedClient);
}
