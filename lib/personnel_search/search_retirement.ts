/**
 * Retirement search — reuses officer retirement fields / flags. No new engine calls.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { ParsedSearchQuery } from "@/lib/personnel_search/parser";

function isPromotionReady(o: CommanderQueryOfficer): boolean {
  const s = o.promotionIntelligence.promotionStatus;
  return s === "EligibleThisYear" || s === "AlreadyEligible";
}

function isNearRetirement(o: CommanderQueryOfficer, horizonYears: number | null): boolean {
  if (o.retirementStatus === "retired") return false;
  if (horizonYears == null || horizonYears <= 1) {
    return o.retirementStatus === "retiring_within_1_year" || o.flagCodes.includes("RETIRING_SOON");
  }
  if (horizonYears <= 2) {
    return (
      o.retirementStatus === "retiring_within_1_year" ||
      o.retirementStatus === "retiring_within_2_years" ||
      o.flagCodes.includes("RETIRING_SOON")
    );
  }
  // 3–5 year windows: use BE year distance when retirementYearBe is known.
  // Caller supplies appointment/as-of year via parsed.yearBe only for exact year match;
  // for horizons without DOB recompute, fall back to within_2_years + ready collision.
  return (
    o.retirementStatus === "retiring_within_1_year" ||
    o.retirementStatus === "retiring_within_2_years" ||
    o.flagCodes.includes("RETIRING_SOON")
  );
}

export function searchRetirement(
  officers: CommanderQueryOfficer[],
  parsed: ParsedSearchQuery,
  asOfYearBe?: number | null
): CommanderQueryOfficer[] {
  const { yearBe, horizonYears, flags } = parsed;

  return officers.filter((o) => {
    if (yearBe != null) {
      return o.retirementYearBe === yearBe;
    }
    if (flags.nearRetirementCollision) {
      return isPromotionReady(o) && isNearRetirement(o, horizonYears ?? 3);
    }
    if (horizonYears != null) {
      return isNearRetirement(o, horizonYears);
    }
    // Default: anyone with a known near-retirement status.
    void asOfYearBe;
    return (
      o.retirementStatus === "retiring_within_1_year" ||
      o.retirementStatus === "retiring_within_2_years" ||
      o.flagCodes.includes("RETIRING_SOON")
    );
  });
}

export function retirementSummaryTh(officer: CommanderQueryOfficer): string {
  if (officer.retirementYearBe != null) return `เกษียณ พ.ศ. ${officer.retirementYearBe}`;
  return officer.retirementStatus;
}
