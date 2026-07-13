import type { DurationYMD } from "@/lib/personnel_calendar";
import type { OfficerFlag, OfficerIntelligenceInput, PromotionStatus, RetirementStatus } from "@/lib/intelligence/types";

export function totalRemainingMonths(duration: DurationYMD | null | undefined): number | null {
  if (!duration) return null;
  return duration.years * 12 + duration.months + (duration.days > 0 ? 1 : 0);
}

export function getRemainingUntilRetirement(input: OfficerIntelligenceInput): DurationYMD | null {
  return input.remainingUntilRetirement ?? input.promotionContext?.remainingUntilRetirement ?? null;
}

export function promotionStatusFromInput(input: OfficerIntelligenceInput): PromotionStatus {
  const result = input.promotionResult;
  if (!result) return "unknown";
  if (result.eligible) return "eligible";
  const maxScore = result.maxScore;
  if (maxScore > 0 && result.score / maxScore >= 0.75) return "near_eligible";
  return "not_eligible";
}

export function retirementStatusFromInput(input: OfficerIntelligenceInput): RetirementStatus {
  const remaining = totalRemainingMonths(getRemainingUntilRetirement(input));
  if (remaining === null) return "unknown";
  if (remaining <= 0) return "retired";
  if (remaining <= 12) return "retiring_within_1_year";
  if (remaining <= 24) return "retiring_within_2_years";
  return "normal";
}

export function hasActiveDocument(input: OfficerIntelligenceInput, typeCode: string): boolean {
  return (input.documents ?? []).some((doc) => doc.typeCode === typeCode && doc.isActive !== false);
}

export function missingTraining(input: OfficerIntelligenceInput): boolean {
  const fromInput = input.trainingRecords ?? input.promotionContext?.trainingRecords ?? [];
  const missingFromPromotion = input.promotionResult?.missingRequirements.some((req) => req.code.startsWith("TRAINING_")) ?? false;
  return fromInput.length === 0 || missingFromPromotion;
}

export function generateOfficerFlags(input: OfficerIntelligenceInput): OfficerFlag[] {
  const flags: OfficerFlag[] = [];
  const promotionStatus = promotionStatusFromInput(input);
  const retirementStatus = retirementStatusFromInput(input);

  if (promotionStatus === "eligible") {
    flags.push({ code: "PROMOTION_READY", label: "Promotion Ready", severity: "info" });
  } else if (promotionStatus === "near_eligible") {
    flags.push({ code: "NEAR_PROMOTION", label: "Near Promotion", severity: "warning" });
  }

  if (retirementStatus === "retiring_within_1_year" || retirementStatus === "retiring_within_2_years") {
    flags.push({ code: "RETIRING_SOON", label: "Retiring Soon", severity: retirementStatus === "retiring_within_1_year" ? "critical" : "serious" });
  }

  if (missingTraining(input)) {
    flags.push({ code: "NEEDS_TRAINING", label: "Needs Training", severity: "warning" });
  }

  const promotionDocumentMissing = input.promotionResult?.missingRequirements.some((req) => req.code.startsWith("DOCUMENT_")) ?? false;
  if (promotionDocumentMissing || (input.documents ?? []).length === 0) {
    flags.push({ code: "DOCUMENTS_MISSING", label: "Documents Missing", severity: "warning" });
  }

  if ((input.profileCompletenessPercent ?? 100) < 70) {
    flags.push({ code: "PROFILE_INCOMPLETE", label: "Profile Incomplete", severity: "warning" });
  }

  if (!input.hasOfficialPortrait) {
    flags.push({ code: "MISSING_OFFICIAL_PORTRAIT", label: "Missing Official Portrait", severity: "warning" });
  }

  return flags;
}
