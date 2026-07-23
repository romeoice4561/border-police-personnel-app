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
import type { MissingEvidenceKey } from "@/lib/promotion/eligibility_policy";

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

/**
 * Promotion Engine output — facade over lib/promotion/eligibility_policy.ts
 * (rule-based, policy-driven level eligibility) + lib/promotion_cycle
 * (Buddhist-Era appointment-cycle tracking). Phase 40A shipped `status`/
 * `eligibleNow`/`monthsUntilEligible`/`overdueYears`/`targetLevel` but left
 * the latter three unconditionally `null` (the facade never actually called
 * the eligibility engine). Phase 41 wires the real computation and answers
 * not just "is this officer eligible" but WHY, SINCE WHEN, and how far up
 * the priority queue they should sit.
 *
 * `status`/`eligibleNow` are kept for backward compatibility — every caller
 * reading the Phase 40A fields keeps working unchanged. `promotionStatus`
 * is the new, richer status (see PromotionStatus below); prefer it plus
 * `displayStatusTh` for anything new.
 */
export interface PromotionSummary extends IntelligenceSummaryBase {
  /** @deprecated Phase 40A score-ratio status. Use promotionStatus for new code. */
  status: "eligible" | "near_eligible" | "not_eligible" | "unknown";
  /** @deprecated Phase 40A field — true for both EligibleThisYear/AlreadyEligible-style outcomes. Use promotionStatus for the specific reason. */
  eligibleNow: boolean;
  monthsUntilEligible: number | null;
  overdueYears: number | null;
  targetLevel: string | null;

  // --- Phase 41: Promotion Intelligence -----------------------------------

  currentRank: string | null;
  currentPosition: string | null;
  /** Always exactly one position level above currentPosition's level — see lib/promotion/eligibility_policy.ts's level-adjacency rule. Duplicates targetLevel above (kept for naming-convention consistency with the Phase 41 spec); both always agree. */
  targetRank: string | null;
  targetPosition: string | null;

  /** The expanded, WHY-explaining status — see PromotionEligibilityStatus. */
  promotionStatus: PromotionEligibilityStatus;

  /** ISO date (YYYY-MM-DD) the officer FIRST became eligible for their next level — the historical date, never "today"/"this year". Null when never eligible, or not computable (e.g. no appointmentCycle on record). */
  eligibleDate: string | null;
  /** Buddhist-Era fiscal year containing eligibleDate. */
  eligibleFiscalYearBe: number | null;

  /**
   * Phase 49.7: ISO date (YYYY-MM-DD) of the officer's first eligible
   * fiscal year for their next level — PROJECTED FORWARD from the tenure
   * policy's requirement (appointmentCycle + requiredCycles) whenever that
   * projection is computable, regardless of whether the officer has reached
   * it yet. Unlike `eligibleDate` (historical-only, null until eligibility
   * is actually reached), this field answers "when WILL/did this officer
   * first qualify" — the field the Officer Profile and Commander Search
   * need to show "ครบคุณสมบัติครั้งแรก: พ.ศ. 2574" for an officer who is not
   * yet eligible. Null only when the projection itself is not computable
   * (Unknown position level, no configured policy, or no appointmentCycle
   * evidence) — never fabricated. Always anchored to 1 January of the
   * eligible Gregorian year, same precision-limit rationale as eligibleDate
   * (Timeline.appointmentCycle is a year, not a full date).
   */
  firstEligibleDate: string | null;
  /** Buddhist-Era fiscal year containing firstEligibleDate. */
  firstEligibleFiscalYearBe: number | null;

  /** Exact time elapsed since eligibleDate, as of asOf — years/months/days, never a decimal. Null when eligibleDate is null. */
  yearsEligible: number | null;
  monthsEligible: number | null;
  daysEligible: number | null;

  /**
   * Estimated number of Thai police promotion (appointment-cycle) rounds the
   * officer has passed through since becoming eligible — an APPROXIMATION
   * (one calendar year ≈ one cycle; see lib/promotion_cycle's documented
   * assumption), not a count of actual historical promotion-board rounds
   * (which the schema does not record). Never fabricated as certainty —
   * `available: false`/null when appointmentCycle is unknown.
   */
  promotionCyclesPassed: number | null;

  /** "ครบคุณสมบัติครั้งแรกเมื่อ 11 สิงหาคม 2567" */
  displayEligibleSinceTh: string | null;
  /** Thai label for promotionStatus, e.g. "ครบคุณสมบัติปีนี้" — see PROMOTION_STATUS_DISPLAY_TH. */
  displayStatusTh: string | null;

  /**
   * Phase 49.7: the configured PROMOTION_POLICIES.minYearsInPositionLevel
   * for `targetLevel` — read directly from the policy table, never
   * recomputed. Null when no policy is configured for the target (Unknown
   * level, or a target with no minYearsInPositionLevel requirement).
   */
  requiredTenureYears: number | null;
  /**
   * Phase 49.7: "ดำรงระดับตำแหน่งปัจจุบันครบ 7 วาระ" — the SAME missing-
   * requirement label the eligibility engine already produces for the
   * MIN_CYCLES_IN_LEVEL blocker (lib/promotion/eligibility_policy.ts),
   * surfaced here so the Officer Profile/Commander Search can show WHY an
   * officer is not yet eligible without re-deriving the sentence. Null when
   * the officer is already eligible or the blocker is a different kind
   * (training/documents/rank/service — see `blockers`-equivalent fields
   * upstream) or eligibility is Unknown.
   */
  waitingReasonTh: string | null;

  /** 0-100 commander-facing priority score — see lib/intelligence/promotion's computePromotionPriority. Higher = should be reviewed sooner. Null when promotionStatus is Unknown (nothing to prioritize). */
  priority: number | null;
  /**
   * Human-readable (English) explanation of the priority score's main
   * driver(s), e.g. "Overdue 2 years; retiring within 18 months". Null when
   * priority is null. Named distinctly from the base `reason` field
   * (IntelligenceSummaryBase.reason — a machine-readable "why unavailable"
   * code, only ever set when `available` is false); this field is a
   * human-readable priority explanation, present exactly when `priority`
   * is non-null, regardless of `available`.
   */
  priorityReason: string | null;

  // --- Phase 49.8: data confidence ---------------------------------------

  /**
   * Phase 49.8: closed, deterministic (non-AI) classification of how much
   * of this PromotionSummary rests on confirmed structured evidence versus
   * a gap. Never a numeric/ML confidence score.
   *   - confirmed: both currentRankStartedAt and (when applicable) the
   *     position-level start date come from explicit structured Timeline
   *     evidence — no gap contributed to this result.
   *   - derived: at least one contributing field came from an approved
   *     centralized fallback rather than a direct exact match (reserved
   *     for a future fallback; today's engine has no rank-tenure fallback,
   *     so this value is not yet reachable from the rank path — see
   *     missingEvidence for what's actually missing when not "confirmed").
   *   - incomplete: eligibility could not be fully assessed because
   *     mandatory tenure evidence (rank-start or position-level-start) is
   *     missing — mirrors promotionStatus === "Unknown" when the gap is
   *     evidence-related (never set merely because promotionStatus is
   *     Unknown due to an unclassifiable position level).
   *   - unknown: the promotion path itself could not be resolved (e.g. no
   *     current position level, no configured policy) — mirrors
   *     promotionStatus === "Unknown" for non-evidence reasons.
   */
  confidence: "confirmed" | "derived" | "incomplete" | "unknown";
  /** Thai sentence explaining `confidence` when it is not "confirmed" — e.g. "ไม่พบวันที่เริ่มครองยศปัจจุบัน". Null when confidence is "confirmed". */
  confidenceReasonTh: string | null;
  /** Stable keys naming every piece of missing evidence (see MissingEvidenceKey in lib/promotion/eligibility_policy.ts) — empty array when confidence is "confirmed". */
  missingEvidence: MissingEvidenceKey[];
}

/**
 * The expanded Promotion Intelligence status (Phase 41) — replaces the
 * ambiguous binary "Eligible"/"Not Eligible" with a status that explains
 * WHY. Every value has a Thai display string (PROMOTION_STATUS_DISPLAY_TH
 * in lib/intelligence/promotion/index.ts). Named distinctly from the
 * pre-existing `PromotionStatus` in lib/intelligence/types.ts (the Phase
 * 40A score-ratio status: eligible/near_eligible/not_eligible/unknown,
 * still used by Dashboard badges) — the two are NOT interchangeable and
 * intentionally kept separate rather than silently reusing the same name
 * for a different meaning.
 *
 *  - EligibleThisYear    — became eligible within the current fiscal year.
 *  - AlreadyEligible      — became eligible in a PRIOR fiscal year and is
 *                          still waiting (the "overdue"/long-waiting case).
 *  - Waiting              — not yet eligible, but on track (no missing
 *                          non-tenure requirement) — just needs more tenure.
 *  - MissingTraining      — blocked specifically by a required training gap.
 *  - MissingDocuments     — blocked specifically by a required document gap.
 *  - RetirementRestricted — blocked by the retirement-window policy rule
 *                          (lib/promotion/rules/retirement_window.ts).
 *  - NotEligible          — blocked for another reason (wrong current level
 *                          adjacency, no configured policy, etc.) or simply
 *                          not on track and no specific blocker above fits.
 *  - Unknown              — not computable at all (e.g. no position level).
 */
export type PromotionEligibilityStatus =
  | "EligibleThisYear"
  | "AlreadyEligible"
  | "Waiting"
  | "MissingTraining"
  | "MissingDocuments"
  | "RetirementRestricted"
  | "NotEligible"
  | "Unknown";

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
