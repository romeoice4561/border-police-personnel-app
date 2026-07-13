import type { OfficerFlag, OfficerIntelligenceInput } from "@/lib/intelligence/types";

const RECOMMENDATION_BY_FLAG: Record<OfficerFlag["code"], string> = {
  PROMOTION_READY: "Officer is ready for promotion review.",
  NEAR_PROMOTION: "Review remaining promotion gaps and prepare the officer for the next cycle.",
  RETIRING_SOON: "Retirement planning should begin.",
  NEEDS_TRAINING: "Complete required training.",
  DOCUMENTS_MISSING: "Complete missing promotion documents.",
  PROFILE_INCOMPLETE: "Update incomplete profile information.",
  MISSING_OFFICIAL_PORTRAIT: "Replace missing official portrait.",
};

export function generateRecommendations(input: OfficerIntelligenceInput, flags: readonly OfficerFlag[]): string[] {
  const recommendations = new Set<string>();

  for (const flag of flags) {
    recommendations.add(RECOMMENDATION_BY_FLAG[flag.code]);
  }

  for (const step of input.promotionResult?.suggestedNextSteps ?? []) {
    recommendations.add(step.detail ? `${step.label} (${step.detail})` : step.label);
  }

  for (const requirement of input.promotionResult?.missingRequirements ?? []) {
    if (requirement.code === "DOCUMENT_GP7") recommendations.add("Complete GP7.");
    else if (requirement.code.startsWith("DOCUMENT_")) recommendations.add(`Complete ${requirement.detail ?? requirement.label}.`);
    else if (requirement.code.startsWith("TRAINING_")) recommendations.add(`Complete required training${requirement.detail ? `: ${requirement.detail}` : ""}.`);
  }

  return [...recommendations];
}
