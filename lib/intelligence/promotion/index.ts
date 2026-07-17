/**
 * Promotion Engine — public Intelligence API (Phase 40A foundation).
 *
 * A thin facade over the EXISTING promotion intelligence, which already
 * spans two production modules this phase does not relocate or rewrite:
 *   - lib/promotion/       — rule-based eligibility scoring (score, passed/
 *                            failed rules, missing requirements)
 *   - lib/promotion_cycle/ — appointment-cycle (B.E.) overdue tracking
 * Both are already composed into `OfficerIntelligenceCard.promotionStatus` /
 * `.promotionResult` by lib/intelligence/dashboard.ts. This module wraps
 * THAT existing, already-correct composition into the shared PromotionSummary
 * shape, so consumers depend on one Intelligence-layer type instead of
 * reading `card.promotionStatus`/`card.promotionResult` ad hoc.
 *
 * Next-level appointment-cycle eligibility (target level, months-until-
 * eligible, overdue years — lib/promotion/eligibility_policy.ts
 * evaluateNextLevelEligibility) needs richer, consumer-specific inputs
 * (current position level, years-in-rank, years-in-position-level, two-step
 * count, appointment cycle) that only Commander Search assembles today via
 * lib/commander_query/position_level.ts's level classification. Phase 40A
 * intentionally does NOT force that computation behind this facade yet —
 * documented as a future extension point in
 * docs/Personnel_Intelligence_Architecture.md — because doing so today would
 * mean duplicating (not consolidating) Commander Search's position-level
 * assembly logic. `computePromotionSummary` below covers the eligibility
 * signal every OTHER consumer (Dashboard, Officer Workspace) already uses.
 */

import type { OfficerIntelligenceCard } from "@/lib/intelligence/types";
import type { PromotionSummary } from "@/lib/intelligence/shared/types";

/** Wraps an already-built OfficerIntelligenceCard's promotion fields into the shared PromotionSummary shape. */
export function computePromotionSummary(card: OfficerIntelligenceCard): PromotionSummary {
  const result = card.promotionResult;
  return {
    available: true,
    status: card.promotionStatus,
    eligibleNow: result?.eligible ?? false,
    monthsUntilEligible: null,
    overdueYears: null,
    targetLevel: null,
  };
}
