/**
 * Deterministic executive priority (Phase 50) — not AI, not appointment odds.
 */
import type { ExecutivePriorityBand, PreparedPromotionRow } from "@/lib/commander_promotion/types";

const PRIORITY_ORDER: Record<ExecutivePriorityBand, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export function prioritySortOrder(band: ExecutivePriorityBand): number {
  return PRIORITY_ORDER[band];
}

/**
 * Ordered evaluation — first match wins.
 */
export function assignExecutivePriority(
  input: Pick<
    PreparedPromotionRow,
    | "executiveBucket"
    | "isPromotionReady"
    | "overdueYears"
    | "retirementWindow"
    | "readinessBand"
    | "hasUnknownPositionHistory"
  >
): ExecutivePriorityBand {
  const near1 = input.retirementWindow === "within1";
  const near3 = input.retirementWindow === "within1" || input.retirementWindow === "within3";

  if (input.executiveBucket === "alreadyEligible" && (input.overdueYears ?? 0) >= 1) return "Critical";
  if (input.isPromotionReady && near1) return "Critical";

  if (input.executiveBucket === "eligibleThisYear") return "High";
  if (input.executiveBucket === "alreadyEligible") return "High";
  if (input.isPromotionReady && near3) return "High";
  if (input.executiveBucket === "incomplete" && near3) return "High";

  if (input.executiveBucket === "nextYear") return "Medium";
  if (input.readinessBand === "high" || input.readinessBand === "complete") return "Medium";
  if (input.executiveBucket === "incomplete" || input.hasUnknownPositionHistory) return "Medium";

  return "Low";
}
