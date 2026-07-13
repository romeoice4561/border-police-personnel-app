/**
 * Shared types for the Personnel Calendar Engine.
 *
 * Pure domain types only — no React, no database, no I/O.
 */

export interface DurationYMD {
  years: number;
  months: number;
  days: number;
}

export interface FiscalYear {
  /** Gregorian fiscal year label. FY 2046 runs 1 Oct 2045 through 30 Sep 2046. */
  year: number;
  start: Date;
  end: Date;
}

export type EligibilityModule = "PROMOTION" | "AWARDS" | "TRAINING" | "RETIREMENT";

export type EligibilityStatus = "eligible" | "not_eligible" | "needs_review" | "not_applicable";

export interface EligibilityContext {
  asOf: Date;
  dateOfBirth?: Date | null;
  governmentServiceStartDate?: Date | null;
  rank?: string | null;
  trainingCodes?: readonly string[];
  awardCodes?: readonly string[];
}

export interface EligibilityResult {
  module: EligibilityModule;
  status: EligibilityStatus;
  reasons: string[];
  effectiveDate?: Date | null;
}

export interface EligibilityRule {
  module: EligibilityModule;
  code: string;
  evaluate(context: EligibilityContext): EligibilityResult;
}
