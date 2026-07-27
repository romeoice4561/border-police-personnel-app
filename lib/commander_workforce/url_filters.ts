/**
 * Presentation-only URL ↔ WorkforceFilterState adapter (Phase 52.2).
 * Reuses normalizeWorkforceFilters — no new filter business rules.
 */
import { EMPTY_WORKFORCE_FILTERS } from "@/lib/commander_workforce/contracts";
import { normalizeWorkforceFilters } from "@/lib/commander_workforce/filters";
import type { WorkforceFilterState } from "@/lib/commander_workforce/types";

/** Stable query key order for deterministic serialize + comparison. */
export const WORKFORCE_FILTER_QUERY_KEYS = [
  "regionPublicCode",
  "divisionPublicCode",
  "companyPublicCode",
  "rank",
  "positionLevel",
  "promotionStatus",
  "retirementWindow",
  "trainingStatus",
  "documentStatus",
  "dataQualityStatus",
  "search",
] as const;

type QueryParamSource = URLSearchParams | { get(name: string): string | null };

function readParam(params: QueryParamSource, key: string): string | null {
  const value = params.get(key);
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Parse URL search params into a normalized WorkforceFilterState.
 * Invalid promotion/retirement values are dropped by normalizeWorkforceFilters.
 */
export function parseWorkforceFiltersFromSearchParams(
  params: QueryParamSource
): WorkforceFilterState {
  return normalizeWorkforceFilters({
    regionPublicCode: readParam(params, "regionPublicCode"),
    divisionPublicCode: readParam(params, "divisionPublicCode"),
    companyPublicCode: readParam(params, "companyPublicCode"),
    rank: readParam(params, "rank"),
    positionLevel: readParam(params, "positionLevel"),
    promotionStatus: readParam(params, "promotionStatus"),
    retirementWindow: readParam(params, "retirementWindow"),
    trainingStatus: readParam(params, "trainingStatus"),
    documentStatus: readParam(params, "documentStatus"),
    dataQualityStatus: readParam(params, "dataQualityStatus"),
    search: readParam(params, "search"),
  });
}

/** Convert Next.js page searchParams record into URLSearchParams. */
export function searchParamsRecordToURLSearchParams(
  record: Record<string, string | string[] | undefined>
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of WORKFORCE_FILTER_QUERY_KEYS) {
    const raw = record[key];
    if (raw == null) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value != null && String(value).trim()) params.set(key, String(value).trim());
  }
  return params;
}

/** Serialize filter to a query string (no leading `?`). Omits null/empty. */
export function serializeWorkforceFiltersToQuery(filters: WorkforceFilterState): string {
  const params = new URLSearchParams();
  const normalized = normalizeWorkforceFilters(filters);
  for (const key of WORKFORCE_FILTER_QUERY_KEYS) {
    const value = normalized[key];
    if (value != null && value !== "") params.set(key, value);
  }
  return normalizeWorkforceQueryString(params.toString());
}

export function normalizeWorkforceQueryString(qs: string): string {
  const raw = qs.startsWith("?") ? qs.slice(1) : qs;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  const ordered = new URLSearchParams();
  for (const key of WORKFORCE_FILTER_QUERY_KEYS) {
    const value = params.get(key);
    if (value != null && value !== "") ordered.set(key, value);
  }
  return ordered.toString();
}

export function countActiveWorkforceFilters(filters: WorkforceFilterState): number {
  const normalized = normalizeWorkforceFilters(filters);
  return WORKFORCE_FILTER_QUERY_KEYS.reduce(
    (n, key) => n + (normalized[key] != null && normalized[key] !== "" ? 1 : 0),
    0
  );
}

export function emptyWorkforceFilters(): WorkforceFilterState {
  return { ...EMPTY_WORKFORCE_FILTERS };
}
