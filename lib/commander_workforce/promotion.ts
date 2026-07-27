/**
 * Promotion section — counts PromotionSummary.promotionStatus only.
 * Does not call promotion calculators or reinterpret policy.
 */

import type { CommanderQueryOfficer } from "@/lib/commander_query/types";
import {
  WORKFORCE_PROMOTION_DESCRIPTION_TH,
  WORKFORCE_PROMOTION_LABEL_TH,
  WORKFORCE_PROMOTION_STATUSES,
  type WorkforcePromotionStatus,
} from "@/lib/commander_workforce/contracts";
import { buildWorkforceDrilldown } from "@/lib/commander_workforce/drilldown";
import type { WorkforcePromotionSection } from "@/lib/commander_workforce/types";

const ELIGIBLE: ReadonlySet<string> = new Set(["EligibleThisYear", "AlreadyEligible"]);
const BLOCKED: ReadonlySet<string> = new Set([
  "MissingTraining",
  "MissingDocuments",
  "RetirementRestricted",
  "NotEligible",
  "Waiting",
]);

export function promotionStatusOf(officer: CommanderQueryOfficer): WorkforcePromotionStatus {
  const status = officer.promotionIntelligence?.promotionStatus;
  if (status && (WORKFORCE_PROMOTION_STATUSES as readonly string[]).includes(status)) {
    return status as WorkforcePromotionStatus;
  }
  return "Unknown";
}

export function buildPromotionSection(
  officers: readonly CommanderQueryOfficer[]
): WorkforcePromotionSection {
  const counts = Object.fromEntries(WORKFORCE_PROMOTION_STATUSES.map((s) => [s, 0])) as Record<
    WorkforcePromotionStatus,
    number
  >;

  for (const officer of officers) {
    counts[promotionStatusOf(officer)] += 1;
  }

  let eligibleTotal = 0;
  let blockedTotal = 0;
  let unknownTotal = 0;
  for (const status of WORKFORCE_PROMOTION_STATUSES) {
    if (ELIGIBLE.has(status)) eligibleTotal += counts[status];
    else if (status === "Unknown") unknownTotal += counts[status];
    else if (BLOCKED.has(status)) blockedTotal += counts[status];
  }

  return {
    totalEvaluated: officers.length,
    eligibleTotal,
    blockedTotal,
    unknownTotal,
    byStatus: WORKFORCE_PROMOTION_STATUSES.map((status) => ({
      status,
      labelTh: WORKFORCE_PROMOTION_LABEL_TH[status],
      descriptionTh: WORKFORCE_PROMOTION_DESCRIPTION_TH[status],
      count: counts[status],
      drilldown: buildWorkforceDrilldown({
        id: `promotion:${status}`,
        label: WORKFORCE_PROMOTION_LABEL_TH[status],
        target: status === "EligibleThisYear" || status === "AlreadyEligible" ? "commander-promotion" : "commander-search",
        filters:
          status === "EligibleThisYear"
            ? { bucket: "eligibleThisYear" }
            : status === "AlreadyEligible"
              ? { bucket: "alreadyEligible" }
              : { promotionEligibilityStatus: status },
      }),
    })),
  };
}
