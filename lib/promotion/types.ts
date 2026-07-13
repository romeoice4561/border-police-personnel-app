/**
 * Promotion Eligibility Engine domain types.
 *
 * Pure TypeScript only — no React, no database, no API calls.
 */

export type PromotionRuleSeverity = "blocking" | "warning" | "advisory";

export interface PromotionRequirement {
  code: string;
  label: string;
  detail?: string;
}

export interface PromotionNextStep {
  code: string;
  label: string;
  detail?: string;
}

export interface PromotionRuleOutcome {
  ruleId: string;
  passed: boolean;
  score: number;
  maxScore: number;
  severity: PromotionRuleSeverity;
  reasons: string[];
  missingRequirements: PromotionRequirement[];
  warnings: string[];
  suggestedNextSteps: PromotionNextStep[];
}

export interface PromotionRule {
  id: string;
  label: string;
  description?: string;
  severity?: PromotionRuleSeverity;
  maxScore?: number;
  evaluate(context: import("@/lib/promotion/context").PromotionEvaluationContext): PromotionRuleOutcome;
}

export interface PromotionEvaluationResult {
  eligible: boolean;
  score: number;
  maxScore: number;
  passedRules: PromotionRuleOutcome[];
  failedRules: PromotionRuleOutcome[];
  missingRequirements: PromotionRequirement[];
  warnings: string[];
  suggestedNextSteps: PromotionNextStep[];
}
