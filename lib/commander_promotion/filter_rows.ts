/**
 * Shared client/server filter helper (Phase 50) — one implementation for
 * table, queue, export, chips, and quick stats.
 */
import type { CommanderPromotionFilterState, PreparedPromotionRow } from "@/lib/commander_promotion/types";
import { computeFilteredQuickStats, type FilteredQuickStats } from "@/lib/commander_promotion/quick_stats";

export function filterPreparedRows(
  rows: readonly PreparedPromotionRow[],
  filter: CommanderPromotionFilterState
): PreparedPromotionRow[] {
  const search = filter.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filter.regionKey != null && row.regionKey !== filter.regionKey) return false;
    if (filter.divisionKey != null && row.divisionKey !== filter.divisionKey) return false;
    if (filter.companyKey != null && row.companyKey !== filter.companyKey) return false;
    if (filter.rank != null && row.rankLabel !== filter.rank) return false;
    if (filter.currentPosition != null && row.currentPositionLabel !== filter.currentPosition) return false;
    if (filter.targetPosition != null && row.targetPositionLabel !== filter.targetPosition) return false;
    if (filter.promotionStatus != null && row.promotionStatus !== filter.promotionStatus) return false;
    if (filter.promotionReadyOnly && !row.isPromotionReady) return false;
    if (filter.bucket != null) {
      if (filter.bucket === "qualifiedNow") {
        // Presentation aggregate: current-year + prior-year eligible (mutually exclusive statuses).
        if (row.executiveBucket !== "eligibleThisYear" && row.executiveBucket !== "alreadyEligible") {
          return false;
        }
      } else if (row.executiveBucket !== filter.bucket) {
        return false;
      }
    }
    if (filter.priority != null && row.priorityBand !== filter.priority) return false;
    if (filter.readinessBand != null && row.readinessBand !== filter.readinessBand) return false;
    if (filter.eligibleYear != null && row.firstEligibleYearBe !== filter.eligibleYear) return false;
    if (filter.eligibleYearMin != null && (row.firstEligibleYearBe == null || row.firstEligibleYearBe < filter.eligibleYearMin))
      return false;
    if (filter.eligibleYearMax != null && (row.firstEligibleYearBe == null || row.firstEligibleYearBe > filter.eligibleYearMax))
      return false;
    if (filter.retirementWindow != null) {
      if (filter.retirementWindow === "within1" && row.retirementWindow !== "within1") return false;
      if (filter.retirementWindow === "within3" && row.retirementWindow !== "within1" && row.retirementWindow !== "within3")
        return false;
      if (filter.retirementWindow === "within5" && !["within1", "within3", "within5"].includes(row.retirementWindow))
        return false;
      if (filter.retirementWindow === "beyond" && row.retirementWindow !== "beyond") return false;
      if (filter.retirementWindow === "unknown" && row.retirementWindow !== "unknown") return false;
    }
    if (filter.blocker != null && !row.blockerKeys.includes(filter.blocker)) return false;
    if (filter.dataQuality != null) {
      if (filter.dataQuality === "missingLevelStart" && !row.hasUnknownPositionHistory) return false;
      if (filter.dataQuality === "missingTarget" && row.targetPositionLabel != null) return false;
      if (filter.dataQuality === "unknownStatus" && row.promotionStatus !== "Unknown") return false;
      if (filter.dataQuality === "missingDocuments" && !row.hasMissingDocuments) return false;
      if (filter.dataQuality === "missingTraining" && !row.hasMissingTraining) return false;
      if (filter.dataQuality === "unknownRetirement" && !row.hasUnknownRetirement) return false;
    }
    if (search && !row.searchText.includes(search)) return false;
    return true;
  });
}

export function filteredQuickStats(rows: readonly PreparedPromotionRow[], filter: CommanderPromotionFilterState): FilteredQuickStats {
  return computeFilteredQuickStats(filterPreparedRows(rows, filter));
}

export function mergeFilter(
  base: CommanderPromotionFilterState,
  patch: Partial<CommanderPromotionFilterState>
): CommanderPromotionFilterState {
  return { ...base, ...patch };
}

export function countActiveFilters(filter: CommanderPromotionFilterState): number {
  let n = 0;
  if (filter.regionKey) n += 1;
  if (filter.divisionKey) n += 1;
  if (filter.companyKey) n += 1;
  if (filter.rank) n += 1;
  if (filter.currentPosition) n += 1;
  if (filter.targetPosition) n += 1;
  if (filter.promotionStatus) n += 1;
  if (filter.bucket) n += 1;
  if (filter.priority) n += 1;
  if (filter.readinessBand) n += 1;
  if (filter.eligibleYear != null) n += 1;
  if (filter.eligibleYearMin != null || filter.eligibleYearMax != null) n += 1;
  if (filter.retirementWindow) n += 1;
  if (filter.blocker) n += 1;
  if (filter.dataQuality) n += 1;
  if (filter.promotionReadyOnly) n += 1;
  if (filter.search.trim()) n += 1;
  return n;
}
