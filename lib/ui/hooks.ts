/**
 * React Query hooks (Phase 14 UI).
 *
 * Typed data hooks over the apiClient, with stable query keys. These are the
 * ONLY place components fetch data — pages/components call hooks, hooks call
 * the client, the client calls the API. No component fetches directly, and no
 * business logic is duplicated here (the hooks just wrap client calls).
 *
 * "use client" so they run in client components.
 */

"use client";

import { useMemo } from "react";
import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import {
  apiClient,
  type GlobalSearchQuery,
  type HealthStatus,
  type OfficerProfile,
  type OfficerQuery,
  type PaginatedResult,
  type RankCount,
  type SearchQuery,
  type OfficerSummary,
  type Statistics,
  type UnitCount,
} from "@/lib/ui/api_client";
import type { OrgTree } from "@/lib/organization/org_tree";
import { organizationEngineFromTree, type OrganizationEngine } from "@/lib/organization/organization_engine";

export const queryKeys = {
  officers: (query: OfficerQuery) => ["officers", query] as const,
  officer: (id: string) => ["officer", id] as const,
  search: (query: SearchQuery) => ["search", query] as const,
  globalSearch: (query: GlobalSearchQuery) => ["globalSearch", query] as const,
  units: () => ["units"] as const,
  ranks: () => ["ranks"] as const,
  statistics: () => ["statistics"] as const,
  health: () => ["health"] as const,
  organizationTree: () => ["organizationTree"] as const,
};

export function useOfficers(query: OfficerQuery): UseQueryResult<PaginatedResult<OfficerSummary>> {
  return useQuery({
    queryKey: queryKeys.officers(query),
    queryFn: () => apiClient.listOfficers(query),
    placeholderData: keepPreviousData, // keep the current page visible while the next loads
  });
}

export function useOfficer(id: string): UseQueryResult<OfficerProfile> {
  return useQuery({
    queryKey: queryKeys.officer(id),
    queryFn: () => apiClient.getOfficer(id),
    enabled: id.length > 0,
  });
}

/** Search hook — only runs when at least one search field is set (avoids the API's 400-on-empty). */
export function useSearch(query: SearchQuery, hasCriteria: boolean): UseQueryResult<PaginatedResult<OfficerSummary>> {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => apiClient.searchOfficers(query),
    placeholderData: keepPreviousData,
    enabled: hasCriteria,
  });
}

/** Phase 26B Part B: Global Search hook — only runs once the query has at least one non-whitespace character. */
export function useGlobalSearch(query: GlobalSearchQuery): UseQueryResult<PaginatedResult<OfficerSummary>> {
  return useQuery({
    queryKey: queryKeys.globalSearch(query),
    queryFn: () => apiClient.globalSearch(query),
    placeholderData: keepPreviousData,
    enabled: query.q.trim().length > 0,
  });
}

export function useUnits(): UseQueryResult<UnitCount[]> {
  return useQuery({ queryKey: queryKeys.units(), queryFn: () => apiClient.listUnits() });
}

export function useRanks(): UseQueryResult<RankCount[]> {
  return useQuery({ queryKey: queryKeys.ranks(), queryFn: () => apiClient.listRanks() });
}

export function useStatistics(): UseQueryResult<Statistics> {
  return useQuery({ queryKey: queryKeys.statistics(), queryFn: () => apiClient.getStatistics() });
}

export function useHealth(): UseQueryResult<HealthStatus> {
  return useQuery({ queryKey: queryKeys.health(), queryFn: () => apiClient.getHealth(), retry: false });
}

/** Phase 26B Part 6 Part S: the shared org-hierarchy snapshot every page's filter framework instance draws Battalion/Company/Division options from. Rarely changes — cached like ranks/units. */
export function useOrgTree(): UseQueryResult<OrgTree> {
  return useQuery({ queryKey: queryKeys.organizationTree(), queryFn: () => apiClient.getOrganizationTree(), staleTime: 5 * 60 * 1000 });
}

/**
 * Phase 27: the shared OrganizationEngine, built from the same org-tree
 * snapshot useOrgTree() fetches. OrganizationEngine is a class instance (not
 * JSON-serializable), so it can't be the query's own return value — this
 * wraps the already-fetched OrgTree client-side instead, memoized so a
 * re-render doesn't rebuild the engine unless the underlying tree changed.
 * Every client component that needs organization dropdowns/cascading should
 * call this ONE hook rather than each building its own
 * `organizationEngineFromTree(orgTree.data)`.
 */
export function useOrganizationEngine(): OrganizationEngine | undefined {
  const orgTree = useOrgTree();
  return useMemo(() => (orgTree.data ? organizationEngineFromTree(orgTree.data) : undefined), [orgTree.data]);
}
