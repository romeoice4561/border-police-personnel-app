/**
 * Commander Intelligence Engine types.
 *
 * Pure domain contracts only — no UI, no database, no APIs.
 */

import type { DurationYMD } from "@/lib/personnel_calendar";
import type { PromotionEvaluationContext, PromotionTrainingRecord } from "@/lib/promotion/context";
import type { PromotionEvaluationResult, PromotionRule } from "@/lib/promotion/types";

export type PromotionStatus = "eligible" | "near_eligible" | "not_eligible" | "unknown";
export type RetirementStatus = "normal" | "retiring_within_2_years" | "retiring_within_1_year" | "retired" | "unknown";
export type CompletenessStatus = "high" | "medium" | "low" | "unknown";
export type OfficerPriority = "low" | "medium" | "high" | "critical";

export type OfficerFlagCode =
  | "PROMOTION_READY"
  | "NEAR_PROMOTION"
  | "RETIRING_SOON"
  | "NEEDS_TRAINING"
  | "DOCUMENTS_MISSING"
  | "PROFILE_INCOMPLETE"
  | "MISSING_OFFICIAL_PORTRAIT";

export interface IntelligenceDocumentSignal {
  typeCode: string;
  isActive?: boolean;
}

export interface OfficerIntelligenceInput {
  officerId: string;
  displayName?: string | null;
  promotionResult?: PromotionEvaluationResult | null;
  promotionContext?: PromotionEvaluationContext | null;
  promotionRules?: readonly PromotionRule[];
  profileCompletenessPercent?: number | null;
  hasOfficialPortrait?: boolean;
  documents?: readonly IntelligenceDocumentSignal[];
  trainingRecords?: readonly PromotionTrainingRecord[];
  remainingUntilRetirement?: DurationYMD | null;
}

export interface OfficerFlag {
  code: OfficerFlagCode;
  label: string;
  severity: "info" | "warning" | "serious" | "critical";
}

export interface OfficerIntelligenceCard {
  officerId: string;
  displayName: string;
  promotionStatus: PromotionStatus;
  retirementStatus: RetirementStatus;
  profileCompleteness: CompletenessStatus;
  priority: OfficerPriority;
  priorityScore: number;
  flags: OfficerFlag[];
  recommendations: string[];
  promotionResult: PromotionEvaluationResult | null;
}

export interface CommanderDashboardSummary {
  totalOfficers: number;
  promotionReady: number;
  nearPromotion: number;
  retiringSoon: number;
  incompleteProfiles: number;
  missingDocuments: number;
  missingGp7: number;
  missingPortrait: number;
  missingTraining: number;
}

export interface CommanderDashboard {
  summary: CommanderDashboardSummary;
  officers: OfficerIntelligenceCard[];
}
