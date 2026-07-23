/**
 * Deterministic sort + pagination for Personnel Intelligence (Phase 49.5).
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { IntelligenceSortField, PaginationDto, SortOrder } from "@/lib/personnel_intelligence_service/types";

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function compareNullableNumber(a: number | null | undefined, b: number | null | undefined, order: SortOrder): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return 1;
  return order === "asc" ? a - b : b - a;
}

function compareString(a: string, b: string, order: SortOrder): number {
  const result = a.localeCompare(b, "th");
  return order === "asc" ? result : -result;
}

/** Stable sort with officerId tie-breaker. Returns a new array. */
export function sortOfficers(
  officers: readonly CommanderQueryOfficer[],
  sort: IntelligenceSortField = "priority",
  order: SortOrder = "desc"
): CommanderQueryOfficer[] {
  const copy = [...officers];
  copy.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case "name":
        primary = compareString(a.displayName, b.displayName, order);
        break;
      case "rank":
        primary = compareString(a.rank, b.rank, order);
        break;
      case "organization":
        primary = compareString(a.currentUnit ?? "", b.currentUnit ?? "", order);
        break;
      case "priority":
        // desc = critical first (lower PRIORITY_RANK first).
        primary =
          order === "desc"
            ? (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
            : (PRIORITY_RANK[b.priority] ?? 9) - (PRIORITY_RANK[a.priority] ?? 9);
        break;
      case "promotionStatus":
        primary = compareString(a.promotionIntelligence.promotionStatus, b.promotionIntelligence.promotionStatus, order);
        break;
      case "retirementYear":
        primary = compareNullableNumber(a.retirementYear, b.retirementYear, order);
        break;
      case "readiness":
        primary = compareString(a.documentIntelligence.readinessLevel, b.documentIntelligence.readinessLevel, order);
        break;
      case "birthday": {
        const aKey = a.dateOfBirth ? a.dateOfBirth.toISOString().slice(5, 10) : "99-99";
        const bKey = b.dateOfBirth ? b.dateOfBirth.toISOString().slice(5, 10) : "99-99";
        primary = compareString(aKey, bKey, order);
        break;
      }
      default:
        primary = 0;
    }
    if (primary !== 0) return primary;
    return a.officerId.localeCompare(b.officerId, "th");
  });
  return copy;
}

export function paginateOfficers(
  officers: readonly CommanderQueryOfficer[],
  page: number,
  pageSize: number
): { pageItems: CommanderQueryOfficer[]; pagination: PaginationDto } {
  const total = officers.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: officers.slice(start, start + pageSize),
    pagination: { page: safePage, pageSize, total, totalPages },
  };
}
