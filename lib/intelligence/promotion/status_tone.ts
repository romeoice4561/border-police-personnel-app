/**
 * PromotionEligibilityStatus -> Badge tone mapping (Phase 43, extracted
 * Phase 44 so Commander Search's results table and the Officer Profile's
 * Promotion Intelligence card share ONE mapping instead of two copies).
 */
import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { BadgeProps } from "@/components/ui/badge";

export const PROMOTION_STATUS_TONE: Record<PromotionEligibilityStatus, NonNullable<BadgeProps["tone"]>> = {
  EligibleThisYear: "good",
  AlreadyEligible: "warning",
  Waiting: "neutral",
  MissingTraining: "serious",
  MissingDocuments: "serious",
  RetirementRestricted: "critical",
  NotEligible: "neutral",
  Unknown: "neutral",
};
