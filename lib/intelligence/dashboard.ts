/**
 * Commander Intelligence Dashboard calculations.
 *
 * Pure orchestration over Personnel Calendar + Promotion Engine outputs.
 */

import { evaluatePromotionEligibility } from "@/lib/promotion";
import { generateOfficerFlags, promotionStatusFromInput, retirementStatusFromInput } from "@/lib/intelligence/flags";
import { priorityFromScore, scoreOfficerPriority } from "@/lib/intelligence/priority";
import { generateRecommendations } from "@/lib/intelligence/recommendations";
import { completenessStatus, summarizeDashboard } from "@/lib/intelligence/summary";
import type { CommanderDashboard, OfficerIntelligenceCard, OfficerIntelligenceInput } from "@/lib/intelligence/types";

export function buildOfficerIntelligenceCard(input: OfficerIntelligenceInput): OfficerIntelligenceCard {
  const promotionResult =
    input.promotionResult ??
    (input.promotionContext && input.promotionRules
      ? evaluatePromotionEligibility(input.promotionContext, input.promotionRules)
      : null);
  const normalizedInput = { ...input, promotionResult };
  const flags = generateOfficerFlags(normalizedInput);
  const priorityScore = scoreOfficerPriority(flags);

  return {
    officerId: input.officerId,
    displayName: input.displayName?.trim() || input.officerId,
    promotionStatus: promotionStatusFromInput(normalizedInput),
    retirementStatus: retirementStatusFromInput(normalizedInput),
    profileCompleteness: completenessStatus(input.profileCompletenessPercent),
    profileCompletenessPercent: input.profileCompletenessPercent ?? null,
    priority: priorityFromScore(priorityScore),
    priorityScore,
    flags,
    recommendations: generateRecommendations(normalizedInput, flags),
    promotionResult,
  };
}

export function buildCommanderDashboard(inputs: readonly OfficerIntelligenceInput[]): CommanderDashboard {
  const officers = inputs.map(buildOfficerIntelligenceCard);
  return {
    summary: summarizeDashboard(inputs, officers),
    officers,
  };
}
