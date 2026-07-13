import { generateOfficerFlags, hasActiveDocument } from "@/lib/intelligence/flags";
import type { CommanderDashboardSummary, OfficerIntelligenceCard, OfficerIntelligenceInput } from "@/lib/intelligence/types";

export function completenessStatus(percent: number | null | undefined): OfficerIntelligenceCard["profileCompleteness"] {
  if (percent == null) return "unknown";
  if (percent >= 85) return "high";
  if (percent >= 70) return "medium";
  return "low";
}

export function summarizeDashboard(inputs: readonly OfficerIntelligenceInput[], cards: readonly OfficerIntelligenceCard[]): CommanderDashboardSummary {
  return {
    totalOfficers: inputs.length,
    promotionReady: cards.filter((card) => card.promotionStatus === "eligible").length,
    nearPromotion: cards.filter((card) => card.promotionStatus === "near_eligible").length,
    retiringSoon: cards.filter((card) => card.flags.some((flag) => flag.code === "RETIRING_SOON")).length,
    incompleteProfiles: cards.filter((card) => card.profileCompleteness === "low").length,
    missingDocuments: inputs.filter((input) => generateOfficerFlags(input).some((flag) => flag.code === "DOCUMENTS_MISSING")).length,
    missingGp7: inputs.filter((input) => !hasActiveDocument(input, "GP7")).length,
    missingPortrait: cards.filter((card) => card.flags.some((flag) => flag.code === "MISSING_OFFICIAL_PORTRAIT")).length,
    missingTraining: cards.filter((card) => card.flags.some((flag) => flag.code === "NEEDS_TRAINING")).length,
  };
}
