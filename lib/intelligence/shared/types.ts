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
import type { ExactDuration } from "@/lib/intelligence/shared/date_types";

/** A summary is either computed successfully, or explicitly "not available" (e.g. missing date of birth) — never a silently-wrong zero. */
export interface IntelligenceSummaryBase {
  /** False when the underlying master data needed for this calculation is missing (e.g. no dateOfBirth for retirement/age). Consumers should treat `false` as "show — / unknown", never as a computed zero. */
  available: boolean;
  /** Machine-readable reason the summary is unavailable (see UnavailableDateReason). Present only when `available` is false. */
  reason?: string;
}

/**
 * Retirement Engine output (facade over lib/personnel_calendar/retirement.ts
 * + lib/intelligence/shared/{exact_duration,thai_date}.ts).
 *
 * Phase 40A fields (`retirementFiscalYear`, `remaining`, `remainingYears`)
 * are kept for backward compatibility with any code already reading them —
 * `retirementFiscalYear` is the Gregorian-labeled internal fiscal-year
 * number (matches lib/personnel_calendar's FiscalYear.year), NOT a
 * Buddhist-Era display value; use `retirementFiscalYearBe` /
 * `displayRetirementYearTh` for anything user-facing. Phase 40B adds the
 * exact-duration and Thai-display fields per the Data Standardization spec.
 */
export interface RetirementSummary extends IntelligenceSummaryBase {
  retirementAge: number;
  /** @deprecated Gregorian-labeled internal fiscal year — never show this to a user. Use retirementFiscalYearBe. */
  retirementFiscalYear: number | null;
  /** Buddhist-Era retirement fiscal year, e.g. 2570 — the value to show a user. */
  retirementFiscalYearBe: number | null;
  retirementDate: Date | null;
  remaining: DurationYMD | null;
  /** @deprecated decimal-years approximation. Use exactRemainingDuration for display. */
  remainingYears: number | null;
  exactRemainingDuration: ExactDuration | null;
  remainingDays: number | null;
  isRetired: boolean;
  /** "11 สิงหาคม 2588" */
  displayRetirementDateTh: string | null;
  /** "ปีงบประมาณ 2588" */
  displayRetirementYearTh: string | null;
  /** "20 ปี 8 เดือน 15 วัน" (or "เกษียณแล้ว" when isRetired) */
  displayRemainingTh: string | null;
}

/**
 * Age Engine output (facade over lib/personnel_calendar/calendar.ts
 * calculateAge). `age`/`ageYears` are the Phase 40A fields, kept for
 * backward compatibility — `ageYears` is a decimal approximation and must
 * NOT be used as a primary display value; prefer `exactAge`/`displayAgeTh`.
 */
export interface AgeSummary extends IntelligenceSummaryBase {
  asOfDate: string;
  birthDate: string | null;
  /** @deprecated alias of exactAge, kept for Phase 40A compatibility. */
  age: DurationYMD | null;
  exactAge: ExactDuration | null;
  /** @deprecated decimal-years approximation. Use exactAge/displayAgeTh for display. */
  ageYears: number | null;
  nextBirthdayDate: string | null;
  nextBirthdayAge: number | null;
  daysUntilNextBirthday: number | null;
  /** "40 ปี 11 เดือน 6 วัน" */
  displayAgeTh: string | null;
  /** "วันเกิดถัดไป 11 สิงหาคม 2570" */
  displayNextBirthdayTh: string | null;
}

/**
 * Service (career-years) Engine output — years of service, in rank, and in
 * position, derived from Timeline rows. Facade over
 * lib/officer_profile/career_calculator.ts + the consolidated timeline-date
 * helpers. `careerYears`/`governmentServiceYears` (decimal) are the Phase
 * 40A fields, kept for backward compatibility — prefer
 * `exactServiceDuration`/`displayServiceDurationTh` for display.
 */
export interface ServiceSummary extends IntelligenceSummaryBase {
  /** @deprecated decimal-years approximation (calculateCareerYearsSimple). Use exactServiceDuration/displayServiceDurationTh for display. */
  careerYears: number | null;
  yearsInRank: number | null;
  yearsInPosition: number | null;
  yearsInPositionLevel: number | null;
  /** @deprecated decimal-years approximation. Use exactServiceDuration/displayServiceDurationTh for display. */
  governmentServiceYears: number | null;
  /** The earliest qualifying Timeline date used as the service-start candidate — see lib/intelligence/service's documented timeline-selection rule. Null when no qualifying entry exists. */
  serviceStartDate: string | null;
  /** The Timeline row id the serviceStartDate was derived from, for traceability. Null when unavailable. */
  sourceTimelineEntryId: number | null;
  exactServiceDuration: ExactDuration | null;
  /** Decimal-years alias of exactServiceDuration for callers that still need a sortable number — prefer exactServiceDuration/displayServiceDurationTh for display. */
  serviceYears: number | null;
  /** "20 ปี 8 เดือน 15 วัน" */
  displayServiceDurationTh: string | null;
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
