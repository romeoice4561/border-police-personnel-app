/**
 * Pure URL ↔ filter serialization for Commander Promotion Intelligence (Phase 50B).
 * No router / React — keep sync logic testable and free of render-time side effects.
 */
import {
  EMPTY_PROMOTION_FILTER,
  PRIORITY_LABEL_TH,
  type CommanderPromotionFilterState,
  type ExecutivePriorityBand,
  type RetirementWindow,
} from "@/lib/commander_promotion/types";
import { isPresentationBucket } from "@/lib/commander_promotion/presentation_labels";
import { mergeFilter } from "@/lib/commander_promotion/filter_rows";

const RETIREMENT_WINDOWS = new Set<RetirementWindow>(["within1", "within3", "within5", "beyond", "unknown"]);

/** Stable query key order for deterministic serialize + comparison. */
const QUERY_KEYS = [
  "bucket",
  "priority",
  "region",
  "division",
  "company",
  "eligibleYear",
  "eligibleYearMin",
  "eligibleYearMax",
  "retirementWindow",
  "ready",
  "blocker",
  "dq",
  "search",
] as const;

export function parsePromotionFilterFromSearchParams(
  params: URLSearchParams | { get(name: string): string | null }
): CommanderPromotionFilterState {
  const patch: Partial<CommanderPromotionFilterState> = {};
  const bucket = params.get("bucket");
  if (isPresentationBucket(bucket)) patch.bucket = bucket;
  const priority = params.get("priority") as ExecutivePriorityBand | null;
  if (priority && priority in PRIORITY_LABEL_TH) patch.priority = priority;
  if (params.get("region")) patch.regionKey = params.get("region");
  if (params.get("division")) patch.divisionKey = params.get("division");
  if (params.get("company")) patch.companyKey = params.get("company");
  const eligibleYear = params.get("eligibleYear");
  if (eligibleYear != null && eligibleYear !== "" && !Number.isNaN(Number(eligibleYear))) {
    patch.eligibleYear = Number(eligibleYear);
  }
  const yearMin = params.get("eligibleYearMin");
  if (yearMin != null && yearMin !== "" && !Number.isNaN(Number(yearMin))) {
    patch.eligibleYearMin = Number(yearMin);
  }
  const yearMax = params.get("eligibleYearMax");
  if (yearMax != null && yearMax !== "" && !Number.isNaN(Number(yearMax))) {
    patch.eligibleYearMax = Number(yearMax);
  }
  const retirement = params.get("retirementWindow") as RetirementWindow | null;
  if (retirement && RETIREMENT_WINDOWS.has(retirement)) patch.retirementWindow = retirement;
  if (params.get("ready") === "1") patch.promotionReadyOnly = true;
  if (params.get("blocker")) patch.blocker = params.get("blocker") as CommanderPromotionFilterState["blocker"];
  if (params.get("dq")) patch.dataQuality = params.get("dq");
  if (params.get("search")) patch.search = params.get("search") ?? "";
  return mergeFilter(EMPTY_PROMOTION_FILTER, patch);
}

/** Serialize filter to a query string (no leading `?`). Omits defaults/nulls. */
export function serializePromotionFilterToQuery(filter: CommanderPromotionFilterState): string {
  const params = new URLSearchParams();
  if (filter.bucket) params.set("bucket", filter.bucket);
  if (filter.priority) params.set("priority", filter.priority);
  if (filter.regionKey) params.set("region", filter.regionKey);
  if (filter.divisionKey) params.set("division", filter.divisionKey);
  if (filter.companyKey) params.set("company", filter.companyKey);
  if (filter.eligibleYear != null) params.set("eligibleYear", String(filter.eligibleYear));
  if (filter.eligibleYearMin != null) params.set("eligibleYearMin", String(filter.eligibleYearMin));
  if (filter.eligibleYearMax != null) params.set("eligibleYearMax", String(filter.eligibleYearMax));
  if (filter.retirementWindow) params.set("retirementWindow", filter.retirementWindow);
  if (filter.promotionReadyOnly) params.set("ready", "1");
  if (filter.blocker) params.set("blocker", filter.blocker);
  if (filter.dataQuality) params.set("dq", filter.dataQuality);
  if (filter.search.trim()) params.set("search", filter.search.trim());
  return normalizeQueryString(params.toString());
}

/** Normalize query string for equality (stable key order, decode-safe compare). */
export function normalizeQueryString(qs: string): string {
  const raw = qs.startsWith("?") ? qs.slice(1) : qs;
  if (!raw) return "";
  const params = new URLSearchParams(raw);
  const ordered = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value != null && value !== "") ordered.set(key, value);
  }
  // Preserve any unexpected keys (sorted) for defensive equality.
  const extras = [...params.keys()].filter((k) => !(QUERY_KEYS as readonly string[]).includes(k)).sort();
  for (const key of extras) {
    const value = params.get(key);
    if (value != null && value !== "") ordered.set(key, value);
  }
  return ordered.toString();
}

export function promotionFiltersEqual(a: CommanderPromotionFilterState, b: CommanderPromotionFilterState): boolean {
  return serializePromotionFilterToQuery(a) === serializePromotionFilterToQuery(b);
}

/** True when navigating to `desiredQuery` would be a no-op vs the current location query. */
export function promotionQueryNeedsNavigation(currentQuery: string, desiredQuery: string): boolean {
  return normalizeQueryString(currentQuery) !== normalizeQueryString(desiredQuery);
}
