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

/**
 * A recommendation's dedup key is its TOPIC, not its exact formatted string.
 * "Needs training" can independently surface from the NEEDS_TRAINING flag,
 * a promotion rule's suggestedNextSteps, and the same rule's
 * missingRequirements — all three describe the identical underlying gap and
 * must collapse to exactly one displayed recommendation (Phase 45.2). The
 * topic for a training/document gap is derived from the requirement/step
 * CODE's stable prefix (e.g. "TRAINING_", "COMPLETE_TRAINING_",
 * "DOCUMENT_") — never from `detail`, which may carry an internal rule
 * identifier (e.g. "ANY_TRAINING") that must never reach the UI verbatim.
 */
function topicForCode(code: string): string {
  if (code.startsWith("COMPLETE_TRAINING_") || code.startsWith("TRAINING_")) return "training";
  if (code === "DOCUMENT_GP7") return "document:gp7";
  if (code.startsWith("DOCUMENT_")) return `document:${code.slice("DOCUMENT_".length)}`;
  return code;
}

export function generateRecommendations(input: OfficerIntelligenceInput, flags: readonly OfficerFlag[]): string[] {
  // Keyed by TOPIC (never the raw formatted string) so the same underlying
  // gap reported by a flag, a suggested next step, AND a missing
  // requirement collapses to one entry — first writer wins, in the fixed
  // priority order below (flags first, since RECOMMENDATION_BY_FLAG's text
  // is the most general/stable phrasing).
  const byTopic = new Map<string, string>();

  for (const flag of flags) {
    byTopic.set(`flag:${flag.code}`, RECOMMENDATION_BY_FLAG[flag.code]);
  }

  for (const step of input.promotionResult?.suggestedNextSteps ?? []) {
    const topic = topicForCode(step.code);
    if (topic === "training" && byTopic.has("flag:NEEDS_TRAINING")) continue;
    if (!byTopic.has(topic)) byTopic.set(topic, step.label);
  }

  for (const requirement of input.promotionResult?.missingRequirements ?? []) {
    const topic = topicForCode(requirement.code);
    if (topic === "training") {
      if (byTopic.has("flag:NEEDS_TRAINING") || byTopic.has("training")) continue;
      byTopic.set(topic, "Complete required training.");
      continue;
    }
    if (requirement.code === "DOCUMENT_GP7") {
      if (!byTopic.has(topic)) byTopic.set(topic, "Complete GP7.");
      continue;
    }
    if (requirement.code.startsWith("DOCUMENT_") && !byTopic.has(topic)) {
      byTopic.set(topic, `Complete ${requirement.label}.`);
    }
  }

  return [...byTopic.values()];
}
