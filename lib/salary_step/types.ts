/**
 * Salary Step Intelligence domain types.
 *
 * This is decision-support only. It does not calculate payroll or hardcode
 * Thai Police regulations.
 */

import type { OfficerIntelligenceCard } from "@/lib/intelligence";

export type SalaryStepReviewCycle = "APRIL" | "OCTOBER" | (string & {});

export type SalaryStepAwardType =
  | "NORMAL"
  | "DOUBLE_STEP"
  | "DEFERRED"
  | "SKIPPED"
  | "COMMANDER_OVERRIDE"
  | (string & {});

export type SalaryStepRuleSeverity = "blocking" | "warning" | "advisory";

export type SalaryStepEligibilityStatus =
  | "eligible_double_step"
  | "standard"
  | "must_skip"
  | "manual_review"
  | "unknown";

export interface SalaryStepHistoryRecord {
  id?: string | number;
  officerId?: string;
  fiscalYear: number;
  reviewCycle: SalaryStepReviewCycle;
  stepsAwarded: number;
  awardType: SalaryStepAwardType;
  remarks?: string | null;
  awardedAt?: Date | null;
}

export interface SalaryStepEvaluationContext {
  officerId: string;
  asOf: Date;
  fiscalYear: number;
  history: readonly SalaryStepHistoryRecord[];
  commanderIntelligence?: OfficerIntelligenceCard | null;
  extensions?: Readonly<Record<string, unknown>>;
}

export interface BuildSalaryStepContextInput
  extends Omit<SalaryStepEvaluationContext, "asOf" | "fiscalYear" | "history"> {
  asOf?: Date;
  fiscalYear?: number;
  history?: readonly SalaryStepHistoryRecord[];
}

export interface SalaryStepRequirement {
  code: string;
  label: string;
  detail?: string;
}

export interface SalaryStepNextAction {
  code: string;
  label: string;
  detail?: string;
}

export interface SalaryStepRuleOutcome {
  ruleId: string;
  passed: boolean;
  severity: SalaryStepRuleSeverity;
  reasons: string[];
  warnings: string[];
  missingRequirements: SalaryStepRequirement[];
  suggestedActions: SalaryStepNextAction[];
  eligibleDoubleStep?: boolean;
  mustSkip?: boolean;
  manualReview?: boolean;
  missingHistory?: boolean;
  policyLimitExceeded?: boolean;
}

export interface SalaryStepRule {
  id: string;
  label: string;
  description?: string;
  severity?: SalaryStepRuleSeverity;
  evaluate(context: SalaryStepEvaluationContext): SalaryStepRuleOutcome;
}

export interface SalaryStepEvaluationResult {
  officerId: string;
  fiscalYear: number;
  eligibility: SalaryStepEligibilityStatus;
  eligibleDoubleStep: boolean;
  mustSkip: boolean;
  manualReview: boolean;
  missingHistory: boolean;
  policyLimitExceeded: boolean;
  totalSteps: number;
  recentHistory: SalaryStepHistoryRecord[];
  passedRules: SalaryStepRuleOutcome[];
  failedRules: SalaryStepRuleOutcome[];
  warnings: string[];
  missingRequirements: SalaryStepRequirement[];
  suggestedActions: SalaryStepNextAction[];
  commanderNotes: string[];
}
