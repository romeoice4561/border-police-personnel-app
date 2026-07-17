/**
 * Shared Personnel Intelligence domain models (Phase 40A foundation).
 *
 * These are the reusable, cross-cutting types every intelligence module
 * (retirement/, age/, service/, promotion/, salary/, document/) and every
 * consumer (Dashboard, Commander Search, Officer Workspace, Statistics)
 * should reference, instead of each page/service inventing its own ad-hoc
 * shape for "years of service" or "retirement info".
 *
 * Pure type declarations — no logic, no I/O, no React.
 */

import type { DurationYMD } from "@/lib/personnel_calendar";

/** A summary is either computed successfully, or explicitly "not available" (e.g. missing date of birth) — never a silently-wrong zero. */
export interface IntelligenceSummaryBase {
  /** False when the underlying master data needed for this calculation is missing (e.g. no dateOfBirth for retirement/age). Consumers should treat `false` as "show — / unknown", never as a computed zero. */
  available: boolean;
}

/** Retirement Engine output (facade over lib/personnel_calendar/retirement.ts). */
export interface RetirementSummary extends IntelligenceSummaryBase {
  retirementAge: number;
  retirementFiscalYear: number | null;
  retirementDate: Date | null;
  remaining: DurationYMD | null;
  remainingYears: number | null;
  isRetired: boolean;
}

/** Age Engine output (facade over lib/personnel_calendar/calendar.ts calculateAge). */
export interface AgeSummary extends IntelligenceSummaryBase {
  age: DurationYMD | null;
  ageYears: number | null;
}

/** Service (career-years) Engine output — years of service, in rank, and in position, derived from Timeline rows. Facade over lib/officer_profile/career_calculator.ts + the consolidated timeline-date helpers. */
export interface ServiceSummary extends IntelligenceSummaryBase {
  careerYears: number | null;
  yearsInRank: number | null;
  yearsInPosition: number | null;
  yearsInPositionLevel: number | null;
  governmentServiceYears: number | null;
}

/** Promotion Engine output — facade over lib/promotion (rule-based eligibility) + lib/promotion_cycle (appointment-cycle tracking). */
export interface PromotionSummary extends IntelligenceSummaryBase {
  status: "eligible" | "near_eligible" | "not_eligible" | "unknown";
  eligibleNow: boolean;
  monthsUntilEligible: number | null;
  overdueYears: number | null;
  targetLevel: string | null;
}

/** Salary Engine output — facade over lib/officer_profile/career_salary_engine.ts (two-step eligibility). */
export interface SalarySummary extends IntelligenceSummaryBase {
  twoStepCount: number;
  eligibleTwoStep: boolean;
  mustSkipStep: boolean;
}

/**
 * Document Engine output — facade over lib/document/document_status.ts +
 * OfficerDocument. Documents are an open, extensible set (any documentType
 * string, e.g. "GP7", "NATIONAL_ID") with no fixed "required checklist" in
 * the current schema, so this summary reports counts over the officer's
 * ACTIVE documents rather than a required/missing checklist that doesn't
 * exist yet — see docs/Personnel_Intelligence_Architecture.md.
 */
export interface DocumentSummary extends IntelligenceSummaryBase {
  activeCount: number;
  verifiedCount: number;
  pendingCount: number;
  hasGp7: boolean;
  hasOfficialPortrait: boolean;
  activeDocumentTypes: string[];
}

/**
 * The full Officer Intelligence bundle — one officer's calculated values
 * from every engine, composed together. This is what Commander View pages
 * should consume; they should never call an individual engine directly nor
 * compute any of these values themselves.
 */
export interface OfficerIntelligence {
  officerId: string;
  retirement: RetirementSummary;
  age: AgeSummary;
  service: ServiceSummary;
  promotion: PromotionSummary;
  salary: SalarySummary;
  document: DocumentSummary;
}
