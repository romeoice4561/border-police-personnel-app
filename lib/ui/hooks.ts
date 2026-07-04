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

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import {
  apiClient,
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

export const queryKeys = {
  officers: (query: OfficerQuery) => ["officers", query] as const,
  officer: (id: string) => ["officer", id] as const,
  search: (query: SearchQuery) => ["search", query] as const,
  units: () => ["units"] as const,
  ranks: () => ["ranks"] as const,
  statistics: () => ["statistics"] as const,
  health: () => ["health"] as const,
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
