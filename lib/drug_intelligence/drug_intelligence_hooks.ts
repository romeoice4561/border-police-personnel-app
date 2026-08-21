/**
 * React Query hooks for Drug Intelligence (Phase DI-1 Round 2).
 *
 * Mirrors lib/ui/hooks.ts's exact convention: components call hooks, hooks
 * call drugIntelligenceClient, no component fetches directly. Every hook
 * requires an `actorId` (from useAuth().user.id) since every Drug
 * Intelligence endpoint enforces permission server-side per-actor — a hook
 * with no signed-in user simply stays disabled rather than firing an
 * unauthenticated request that would 401.
 */
"use client";

import { useQuery, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import {
  drugIntelligenceClient,
  type DrugCaseListQuery,
  type DrugCaseListRow,
  type DrugCaseDetailResponse,
  type DrugIntelligenceStats,
  type DrugPersonDetailResponse,
} from "@/lib/drug_intelligence/drug_intelligence_client";

export interface DrugPageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const drugQueryKeys = {
  stats: (actorId: string | null) => ["drug-stats", actorId] as const,
  cases: (actorId: string | null, query: DrugCaseListQuery) => ["drug-cases", actorId, query] as const,
  case: (actorId: string | null, caseId: string) => ["drug-case", actorId, caseId] as const,
  person: (actorId: string | null, personId: string) => ["drug-person", actorId, personId] as const,
};

export function useDrugStats(actorId: string | null): UseQueryResult<DrugIntelligenceStats> {
  return useQuery({
    queryKey: drugQueryKeys.stats(actorId),
    queryFn: () => drugIntelligenceClient.getStats(actorId as string),
    enabled: Boolean(actorId),
  });
}

export function useDrugCases(actorId: string | null, query: DrugCaseListQuery): UseQueryResult<{ rows: DrugCaseListRow[]; meta: DrugPageMeta }> {
  return useQuery({
    queryKey: drugQueryKeys.cases(actorId, query),
    queryFn: () => drugIntelligenceClient.listCases(actorId as string, query),
    enabled: Boolean(actorId),
    placeholderData: keepPreviousData,
  });
}

export function useDrugCase(actorId: string | null, caseId: string): UseQueryResult<DrugCaseDetailResponse> {
  return useQuery({
    queryKey: drugQueryKeys.case(actorId, caseId),
    queryFn: () => drugIntelligenceClient.getCase(caseId, actorId as string),
    enabled: Boolean(actorId) && caseId.length > 0,
  });
}

/** Section 18's Person Detail Drawer data — enabled only while a person is actually selected (personId non-empty), so opening the drawer is what triggers the fetch, not the workspace mounting. */
export function useDrugPerson(actorId: string | null, personId: string): UseQueryResult<DrugPersonDetailResponse> {
  return useQuery({
    queryKey: drugQueryKeys.person(actorId, personId),
    queryFn: () => drugIntelligenceClient.getPersonDetail(personId, actorId as string),
    enabled: Boolean(actorId) && personId.length > 0,
  });
}
