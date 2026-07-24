/**
 * Promotion search — reads PromotionSummary only. No calculations.
 */
import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import type { ParsedSearchQuery } from "@/lib/personnel_search/parser";

function matchesTarget(officer: CommanderQueryOfficer, targetLevelHint: string | null): boolean {
  if (!targetLevelHint) return true;
  const hay = `${officer.promotionIntelligence.targetLevel ?? ""} ${officer.promotionIntelligence.targetPosition ?? ""}`;
  return hay.includes(targetLevelHint);
}

export function searchPromotion(
  officers: CommanderQueryOfficer[],
  parsed: ParsedSearchQuery
): CommanderQueryOfficer[] {
  const { flags, targetLevelHint } = parsed;

  const wantsTarget = Boolean(targetLevelHint && /ครบขึ้น|พร้อมเลื่อน|ผกก|รองผู้กำกับ/.test(parsed.raw));

  return officers.filter((o) => {
    const p = o.promotionIntelligence;
    if (!p.available) return false;
    if (wantsTarget && !matchesTarget(o, targetLevelHint)) return false;

    if (flags.alreadyEligible) return p.promotionStatus === "AlreadyEligible";
    if (flags.promotionReadyThisYear) return p.promotionStatus === "EligibleThisYear";
    if (flags.promotionReadyNextYear) {
      if (p.promotionStatus === "Waiting" && p.remainingTenureYears != null) {
        return p.remainingTenureYears <= 1;
      }
      return false;
    }
    if (flags.missingTraining) return p.promotionStatus === "MissingTraining";
    if (flags.missingDocuments) return p.promotionStatus === "MissingDocuments";

    if (/พร้อมเลื่อน|ครบคุณสมบัติ|ครบขึ้น/.test(parsed.raw)) {
      return p.promotionStatus === "EligibleThisYear" || p.promotionStatus === "AlreadyEligible";
    }

    return p.promotionStatus === "EligibleThisYear" || p.promotionStatus === "AlreadyEligible";
  });
}

export function promotionSummaryTh(officer: CommanderQueryOfficer): string {
  const p = officer.promotionIntelligence;
  const target = p.targetLevel ?? p.targetPosition;
  const status = p.displayStatusTh ?? p.promotionStatus;
  return target ? `${status} → ${target}` : status;
}
