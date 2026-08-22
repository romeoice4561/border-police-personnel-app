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

import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import {
  drugIntelligenceClient,
  type DrugCaseListQuery,
  type DrugCaseListRow,
  type DrugCaseDetailResponse,
  type DrugIntelligenceStats,
  type DrugPersonDetailResponse,
  type DrugPersonDirectoryQuery,
  type DrugPersonDirectoryRow,
  type DrugPersonProfileResponse,
  type DrugPersonProfileUpdateInput,
  type DrugPersonMatchCandidate,
  type DrugUnresolvedMatchPair,
  type DrugPersonMergePreview,
  type DrugSearchGroupedQuery,
  type DrugSearchByTypeQuery,
  type DrugSearchGroupedResults,
  type DrugSearchResult,
  type DrugPhoneDetailResponse,
  type DrugSimDetailResponse,
  type DrugDeviceDetailResponse,
  type DrugVehicleDetailResponse,
  type DrugGraphNeighborhoodQuery,
  type DrugGraphNeighborhoodResponse,
  type DrugGraphPathQuery,
  type DrugGraphPathResponse,
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
  // DI-2 Round B
  personDirectory: (actorId: string | null, query: DrugPersonDirectoryQuery) => ["drug-person-directory", actorId, query] as const,
  personProfile: (actorId: string | null, personId: string) => ["drug-person-profile", actorId, personId] as const,
  potentialDuplicates: (actorId: string | null, personId: string) => ["drug-person-potential-duplicates", actorId, personId] as const,
  matchReviewQueue: (actorId: string | null) => ["drug-match-review-queue", actorId] as const,
  mergePreview: (actorId: string | null, survivorPersonId: string, mergedPersonId: string) =>
    ["drug-merge-preview", actorId, survivorPersonId, mergedPersonId] as const,
  // DI-3
  searchGrouped: (actorId: string | null, query: DrugSearchGroupedQuery) => ["drug-search-grouped", actorId, query] as const,
  searchByType: (actorId: string | null, query: DrugSearchByTypeQuery) => ["drug-search-by-type", actorId, query] as const,
  phoneDetail: (actorId: string | null, phoneNumberId: string) => ["drug-phone-detail", actorId, phoneNumberId] as const,
  simDetail: (actorId: string | null, simId: string) => ["drug-sim-detail", actorId, simId] as const,
  deviceDetail: (actorId: string | null, deviceId: string) => ["drug-device-detail", actorId, deviceId] as const,
  vehicleDetail: (actorId: string | null, vehicleId: string) => ["drug-vehicle-detail", actorId, vehicleId] as const,
  // DI-5
  networkNeighborhood: (actorId: string | null, query: DrugGraphNeighborhoodQuery) => ["drug-network-neighborhood", actorId, query] as const,
  networkPath: (actorId: string | null, query: DrugGraphPathQuery) => ["drug-network-path", actorId, query] as const,
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

// ── DI-2 Round B ──────────────────────────────────────────────────────────

export function useDrugPersonDirectory(actorId: string | null, query: DrugPersonDirectoryQuery): UseQueryResult<{ rows: DrugPersonDirectoryRow[]; meta: DrugPageMeta }> {
  return useQuery({
    queryKey: drugQueryKeys.personDirectory(actorId, query),
    queryFn: () => drugIntelligenceClient.getPersonDirectory(actorId as string, query),
    enabled: Boolean(actorId),
    placeholderData: keepPreviousData,
  });
}

export function useDrugPersonProfile(actorId: string | null, personId: string): UseQueryResult<DrugPersonProfileResponse> {
  return useQuery({
    queryKey: drugQueryKeys.personProfile(actorId, personId),
    queryFn: () => drugIntelligenceClient.getPersonProfile(personId, actorId as string),
    enabled: Boolean(actorId) && personId.length > 0,
  });
}

export function useDrugPotentialDuplicates(actorId: string | null, personId: string): UseQueryResult<{ candidates: DrugPersonMatchCandidate[] }> {
  return useQuery({
    queryKey: drugQueryKeys.potentialDuplicates(actorId, personId),
    queryFn: () => drugIntelligenceClient.getPotentialDuplicates(personId, actorId as string),
    enabled: Boolean(actorId) && personId.length > 0,
  });
}

export function useDrugMatchReviewQueue(actorId: string | null): UseQueryResult<DrugUnresolvedMatchPair[]> {
  return useQuery({
    queryKey: drugQueryKeys.matchReviewQueue(actorId),
    queryFn: () => drugIntelligenceClient.getMatchReviewQueue(actorId as string),
    enabled: Boolean(actorId),
  });
}

export function useDrugMergePreview(actorId: string | null, survivorPersonId: string, mergedPersonId: string): UseQueryResult<DrugPersonMergePreview> {
  return useQuery({
    queryKey: drugQueryKeys.mergePreview(actorId, survivorPersonId, mergedPersonId),
    queryFn: () => drugIntelligenceClient.getMergePreview(actorId as string, survivorPersonId, mergedPersonId),
    enabled: Boolean(actorId) && survivorPersonId.length > 0 && mergedPersonId.length > 0 && survivorPersonId !== mergedPersonId,
  });
}

/** Section 21: profile field edit (canonical name/nationality/DOB/notes). Invalidates the profile and directory caches on success so the edited value is reflected immediately, no manual refetch or page reload. */
export function useUpdateDrugPersonProfile(actorId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, body }: { personId: string; body: DrugPersonProfileUpdateInput }) => drugIntelligenceClient.updatePersonProfile(personId, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.personProfile(actorId, variables.personId) });
      queryClient.invalidateQueries({ queryKey: ["drug-person-directory"] });
    },
  });
}

/** Section 22: add alias. */
export function useAddDrugPersonAlias(actorId: string | null, actorName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, fullName }: { personId: string; fullName: string }) =>
      drugIntelligenceClient.addPersonAlias(personId, { actorId: actorId as string, actorName, fullName }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.personProfile(actorId, variables.personId) });
    },
  });
}

/** Section 23: add identifier — never bypasses the duplicate engine, returns candidates for the caller to surface as a warning. */
export function useAddDrugPersonIdentifier(actorId: string | null, actorName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, type, value, notes }: { personId: string; type: string; value: string; notes?: string | null }) =>
      drugIntelligenceClient.addPersonIdentifier(personId, { actorId: actorId as string, actorName, type, value, notes }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.personProfile(actorId, variables.personId) });
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.potentialDuplicates(actorId, variables.personId) });
    },
  });
}

/** Section 19: persistent NOT_SAME / CONFIRMED_DUPLICATE decision. Invalidates the review queue and both persons' profiles/potential-duplicates so the decision is reflected everywhere immediately. */
export function useDecideDrugMatchReview(actorId: string | null, actorName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { personAId: string; personBId: string; decision: "CONFIRMED_DUPLICATE" | "NOT_SAME"; signals?: unknown; notes?: string | null }) =>
      drugIntelligenceClient.decideMatchReview({ actorId: actorId as string, actorName, ...body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.matchReviewQueue(actorId) });
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.potentialDuplicates(actorId, variables.personAId) });
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.potentialDuplicates(actorId, variables.personBId) });
      queryClient.invalidateQueries({ queryKey: ["drug-person-directory"] });
    },
  });
}

/** Sections 15-18: transactional merge. Invalidates the review queue, directory, and both persons' profiles so the survivor's updated data and the merged person's MERGED banner show immediately without a page reload. */
export function useMergeDrugPersons(actorId: string | null, actorName: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { survivorPersonId: string; mergedPersonId: string; reason?: string | null }) =>
      drugIntelligenceClient.mergePersons({ actorId: actorId as string, actorName, ...body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.matchReviewQueue(actorId) });
      queryClient.invalidateQueries({ queryKey: ["drug-person-directory"] });
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.personProfile(actorId, variables.survivorPersonId) });
      queryClient.invalidateQueries({ queryKey: drugQueryKeys.personProfile(actorId, variables.mergedPersonId) });
    },
  });
}

// ── DI-3: Global Intelligence Search ────────────────────────────────────

/** Section 3/10: the Global Search page's grouped overview. `actorName` is required (unlike most read hooks) because the endpoint writes a search_performed audit row. */
export function useDrugSearchGrouped(actorId: string | null, actorName: string, query: DrugSearchGroupedQuery): UseQueryResult<DrugSearchGroupedResults> {
  return useQuery({
    queryKey: drugQueryKeys.searchGrouped(actorId, query),
    queryFn: () => drugIntelligenceClient.searchGrouped(actorId as string, actorName, query),
    enabled: Boolean(actorId) && query.q.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}

/** Section 24: single-entity-type paginated drill-in ("ดูทั้งหมด"). */
export function useDrugSearchByType(actorId: string | null, query: DrugSearchByTypeQuery): UseQueryResult<{ rows: DrugSearchResult[]; meta: DrugPageMeta }> {
  return useQuery({
    queryKey: drugQueryKeys.searchByType(actorId, query),
    queryFn: () => drugIntelligenceClient.searchByType(actorId as string, query),
    enabled: Boolean(actorId) && query.q.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}

// ── DI-3: Entity Detail ──────────────────────────────────────────────────

export function useDrugPhoneDetail(actorId: string | null, phoneNumberId: string): UseQueryResult<DrugPhoneDetailResponse> {
  return useQuery({
    queryKey: drugQueryKeys.phoneDetail(actorId, phoneNumberId),
    queryFn: () => drugIntelligenceClient.getPhoneDetail(phoneNumberId, actorId as string),
    enabled: Boolean(actorId) && phoneNumberId.length > 0,
  });
}

export function useDrugSimDetail(actorId: string | null, simId: string): UseQueryResult<DrugSimDetailResponse> {
  return useQuery({
    queryKey: drugQueryKeys.simDetail(actorId, simId),
    queryFn: () => drugIntelligenceClient.getSimDetail(simId, actorId as string),
    enabled: Boolean(actorId) && simId.length > 0,
  });
}

export function useDrugDeviceDetail(actorId: string | null, deviceId: string): UseQueryResult<DrugDeviceDetailResponse> {
  return useQuery({
    queryKey: drugQueryKeys.deviceDetail(actorId, deviceId),
    queryFn: () => drugIntelligenceClient.getDeviceDetail(deviceId, actorId as string),
    enabled: Boolean(actorId) && deviceId.length > 0,
  });
}

export function useDrugVehicleDetail(actorId: string | null, vehicleId: string): UseQueryResult<DrugVehicleDetailResponse> {
  return useQuery({
    queryKey: drugQueryKeys.vehicleDetail(actorId, vehicleId),
    queryFn: () => drugIntelligenceClient.getVehicleDetail(vehicleId, actorId as string),
    enabled: Boolean(actorId) && vehicleId.length > 0,
  });
}

// ── DI-5: Network Intelligence / Link Analysis ────────────────────────────

export function useDrugNetworkNeighborhood(actorId: string | null, query: DrugGraphNeighborhoodQuery): UseQueryResult<DrugGraphNeighborhoodResponse> {
  return useQuery({
    queryKey: drugQueryKeys.networkNeighborhood(actorId, query),
    queryFn: () => drugIntelligenceClient.getNetworkNeighborhood(actorId as string, query),
    enabled: Boolean(actorId) && query.entityId.length > 0,
  });
}

export function useDrugNetworkPath(actorId: string | null, query: DrugGraphPathQuery | null): UseQueryResult<DrugGraphPathResponse> {
  return useQuery({
    queryKey: drugQueryKeys.networkPath(actorId, query ?? { fromType: "PERSON", fromId: "", toType: "PERSON", toId: "" }),
    queryFn: () => drugIntelligenceClient.getNetworkPath(actorId as string, query as DrugGraphPathQuery),
    enabled: Boolean(actorId) && Boolean(query) && query!.fromId.length > 0 && query!.toId.length > 0,
  });
}
