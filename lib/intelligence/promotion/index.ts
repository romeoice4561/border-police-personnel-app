/**
 * Promotion Intelligence Engine — public Intelligence API (Phase 40A
 * foundation; Phase 41 builds the full engine).
 *
 * Phase 40A shipped a thin facade that only ever wrapped an
 * already-built `OfficerIntelligenceCard`'s score-ratio `promotionStatus` —
 * `monthsUntilEligible`/`overdueYears`/`targetLevel` were unconditionally
 * `null` because the facade never called the real eligibility engine
 * (lib/promotion/eligibility_policy.ts). Phase 41 closes that gap: this
 * module is now the single place that turns a Master-Data officer into a
 * full "why is this officer eligible/blocked, since when, how urgently"
 * answer — the one thing every consumer (Commander Dashboard, Commander
 * Search, Officer Profile, AI Commander, Reports) should read instead of
 * re-deriving eligibility themselves.
 *
 * No engine was relocated or rewritten to build this. It composes THREE
 * existing, stable systems, unchanged:
 *   - lib/promotion/eligibility_policy.ts — policy-driven blocking/tenure
 *     eligibility for the officer's NEXT position level (the richest
 *     existing computation; already wired into Commander Search via
 *     lib/server/commander_query_service.ts).
 *   - lib/promotion_cycle/ — Buddhist-Era appointment-cycle bucketing.
 *   - lib/intelligence/shared/{exact_duration,thai_date}.ts — Phase 40B's
 *     exact-duration/Buddhist-Era display primitives, reused (not
 *     reimplemented) for "how long has this officer been eligible".
 *
 * Master data in -> Intelligence summary out. No UI, no I/O.
 */

import { evaluateNextLevelEligibility, policyForTargetLevel, type EligibilityOfficer, type LevelEligibilityResult, type MissingEvidenceKey } from "@/lib/promotion/eligibility_policy";
import { normalizePositionLevel, nextPositionLevel, UNKNOWN_POSITION_LEVEL } from "@/lib/commander_query/position_level";
import { yearBEToGregorian } from "@/lib/officer_profile/thai_date";
import { utcDate } from "@/lib/personnel_calendar";
import { computeExactDuration, formatExactDurationTh } from "@/lib/intelligence/shared/exact_duration";
import { formatFullThaiDateTh, toBuddhistEraYear } from "@/lib/intelligence/shared/thai_date";
import type { OfficerIntelligenceCard } from "@/lib/intelligence/types";
import type { PromotionSummary, PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";

/** Thai government fiscal year (1 Oct - 30 Sep), Buddhist-Era labeled, containing `date`. Local re-derivation avoids a circular import on lib/intelligence/shared/fiscal_year.ts's computeFiscalYearSummary (same rule, just inlined for this module's two call sites). */
function fiscalYearBeForDate(date: Date): number {
  const gregorianFiscalYear = date.getUTCMonth() + 1 >= 10 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  return toBuddhistEraYear(gregorianFiscalYear);
}

/**
 * Thai display text for every PromotionEligibilityStatus value — the ONE
 * place these labels are defined, so Commander View/Reports/AI never
 * hand-roll their own Thai status text. Wording per Phase 41 Task 8's
 * spec, reusing the vocabulary already established by
 * lib/promotion_cycle/display.ts ("ครบคุณสมบัติ", "ครบขึ้น...", "รอบแต่งตั้ง").
 */
export const PROMOTION_STATUS_DISPLAY_TH: Record<PromotionEligibilityStatus, string> = {
  EligibleThisYear: "ครบคุณสมบัติในปีนี้",
  AlreadyEligible: "มีคุณสมบัติครบมาแล้ว",
  Waiting: "ยังไม่ครบคุณสมบัติ",
  MissingTraining: "ขาดคุณสมบัติด้านการฝึกอบรม",
  MissingDocuments: "ขาดเอกสารประกอบการพิจารณา",
  RetirementRestricted: "ใกล้เกษียณอายุราชการ",
  NotEligible: "ยังไม่ครบคุณสมบัติ",
  Unknown: "ไม่สามารถประเมินได้",
};

/**
 * Determines the expanded WHY-explaining status from the eligibility
 * engine's result. Ordering matters: a specific blocker (training/
 * documents/retirement) is reported before the generic Waiting/NotEligible
 * fallback, so a commander sees the ACTIONABLE reason first.
 *
 * KNOWN LIMITATION — RetirementRestricted: lib/promotion/rules/
 * retirement_window.ts is registered as a "warning"-severity rule (see
 * lib/promotion/result.ts's aggregatePromotionResults — only "blocking"
 * failures populate `missingRequirements`), so a retirement-window failure
 * never appears in `LevelEligibilityResult.missingRequirements` and cannot
 * be distinguished from a generic NotEligible/Waiting outcome through the
 * eligibility_policy.ts result alone. No current PROMOTION_POLICIES entry
 * configures `minRetirementRemainingMonths` anyway (confirmed by audit), so
 * this status is reachable in the type system (for whenever a policy DOES
 * configure it and the engine is extended to surface warning-severity
 * blockers distinctly) but is not producible from today's data. Documented
 * here and in docs/Personnel_Intelligence_Architecture.md rather than
 * faked with an always-false check.
 */
function classifyStatus(
  level: LevelEligibilityResult | null,
  eligibleFiscalYearBe: number | null,
  currentFiscalYearBe: number
): PromotionEligibilityStatus {
  if (!level) return "Unknown";

  // Phase 49.8: mandatory tenure evidence (rank-start or position-level-start
  // date) is missing — this is NEVER eligible now (evaluateWithPolicy already
  // guarantees eligibleNow is false whenever evidenceIncomplete is true), and
  // it must not be reported as a confirmed "Waiting"/"NotEligible" either —
  // both would imply the system KNOWS the officer falls short, when in fact
  // it simply cannot assess. Checked before the training/documents/generic
  // branches so an evidence gap is never silently reclassified as a
  // different, more specific-sounding blocker.
  if (level.evidenceIncomplete) return "Unknown";

  const missingCodes = level.missingRequirements.map((requirement) => requirement.code);
  const blockedByTraining = missingCodes.some((code) => code.startsWith("TRAINING_"));
  const blockedByDocuments = missingCodes.some((code) => code.startsWith("DOCUMENT_"));

  if (level.eligibleNow) {
    if (eligibleFiscalYearBe != null && eligibleFiscalYearBe === currentFiscalYearBe) return "EligibleThisYear";
    return "AlreadyEligible";
  }
  if (blockedByTraining) return "MissingTraining";
  if (blockedByDocuments) return "MissingDocuments";
  if (level.status === "eligible_soon" || level.status === "not_eligible") return "Waiting";
  return "NotEligible";
}

/**
 * Walks the officer's position-level tenure backward to find the FIRST
 * fiscal year they satisfied the tenure requirement for their next level —
 * i.e. the historical `eligibleCycle` the appointment-cycle engine already
 * computes (lib/promotion_cycle/engine.ts's
 * `eligibleCycle = appointmentCycle + requiredCycles`), converted to a
 * real calendar date.
 *
 * IMPORTANT — precision limit: `Timeline.appointmentCycle` is a plain
 * Buddhist-Era YEAR integer, not a full date (confirmed: no day/month
 * granularity exists anywhere in the schema for when an officer entered a
 * position level). `eligibleDate` is therefore anchored to 1 January of
 * the eligible Gregorian year — the earliest calendar date consistent with
 * "eligible as of this Buddhist-Era year," never a fabricated day/month.
 * This is documented, not silently approximated.
 */
function computeEligibleDate(level: LevelEligibilityResult | null): Date | null {
  if (!level?.eligibleNow) return null;
  // Prefer exact Timeline-derived first-eligible date when day/month evidence exists.
  if (level.exactFirstEligibleDate) return level.exactFirstEligibleDate;
  if (!level.promotionCycle?.eligibleCycle) return null;
  const eligibleGregorianYear = yearBEToGregorian(level.promotionCycle.eligibleCycle);
  return utcDate(eligibleGregorianYear, 1, 1);
}

/**
 * Phase 49.7: the officer's FIRST eligible date, projected forward from the
 * tenure policy regardless of whether they have reached it yet — unlike
 * computeEligibleDate above (historical-only, null pre-eligibility).
 *
 * Phase 49.9: when LevelEligibilityResult.exactFirstEligibleDate is present
 * (`addYears(positionLevelStartedAt, minYears)` from the eligibility engine),
 * that exact calendar date is preferred over the Jan-1 appointment-cycle
 * year anchor. Falls back to eligibleCycle year when only year evidence exists.
 */
function computeFirstEligibleDate(level: LevelEligibilityResult | null): Date | null {
  if (level?.exactFirstEligibleDate) return level.exactFirstEligibleDate;
  if (!level?.promotionCycle?.eligibleCycle) return null;
  const eligibleGregorianYear = yearBEToGregorian(level.promotionCycle.eligibleCycle);
  return utcDate(eligibleGregorianYear, 1, 1);
}

/**
 * Missed appointment cycles since becoming eligible — equals
 * `yearsAfterEligibility` / `overdueYears` (first eligible cycle = 0).
 * Distinct from the engine's `completedPromotionCycles` (years since the
 * appointment cycle began) and from `eligibleYearOrdinal` (1-based year).
 */
function computePromotionCyclesPassed(level: LevelEligibilityResult | null): number | null {
  if (!level?.eligibleNow || level.promotionCycle?.yearsAfterEligibility == null) return null;
  return level.promotionCycle.yearsAfterEligibility;
}

/** Thai sentence for each MissingEvidenceKey — the ONE place these are worded, reused by confidenceReasonTh below. Deliberately closed to the same key set as eligibility_policy.ts's MissingEvidenceKey. */
const MISSING_EVIDENCE_LABEL_TH: Record<MissingEvidenceKey, string> = {
  current_rank_start_date: "ไม่พบวันที่เริ่มครองยศปัจจุบัน",
  current_position_level_start_date: "ไม่พบวันที่เริ่มดำรงระดับตำแหน่งปัจจุบัน",
  promotion_policy: "ไม่มีเกณฑ์การเลื่อนตำแหน่งที่กำหนดไว้",
  training_data: "ไม่มีข้อมูลการฝึกอบรม",
  document_data: "ไม่มีข้อมูลเอกสาร",
  retirement_data: "ไม่มีข้อมูลวันเกิด",
};

/**
 * Phase 49.8: deterministic, non-AI confidence classification — see
 * PromotionSummary.confidence's doc comment for the full meaning of each
 * value. Reads ONLY level.evidenceIncomplete/missingEvidence (already
 * computed by evaluateWithPolicy) — no new evidence-detection logic here.
 */
function computeConfidence(level: LevelEligibilityResult | null): {
  confidence: PromotionSummary["confidence"];
  confidenceReasonTh: string | null;
  missingEvidence: MissingEvidenceKey[];
} {
  if (!level) return { confidence: "unknown", confidenceReasonTh: null, missingEvidence: [] };
  if (level.evidenceIncomplete) {
    const missingEvidence = level.missingEvidence;
    const confidenceReasonTh = missingEvidence.map((key) => MISSING_EVIDENCE_LABEL_TH[key]).join(" ") || null;
    return { confidence: "incomplete", confidenceReasonTh, missingEvidence };
  }
  return { confidence: "confirmed", confidenceReasonTh: null, missingEvidence: [] };
}

/**
 * Phase 49.7/49.10: tenure-shortfall label from MIN_CYCLES_IN_LEVEL (now
 * year-based, no "วาระ"). Null when already eligible or blocked by something else.
 */
function computeWaitingReasonTh(level: LevelEligibilityResult | null): string | null {
  if (!level || level.eligibleNow) return null;
  const tenureBlocker = level.missingRequirements.find((requirement) => requirement.code === "MIN_CYCLES_IN_LEVEL");
  return tenureBlocker?.label ?? null;
}

function calendarYearBeFromDate(date: Date): number {
  return toBuddhistEraYear(date.getUTCFullYear());
}

function yearsHeldApprox(eligibilityOfficer: EligibilityOfficer, requiredTenureYears: number | null): number | null {
  if (eligibilityOfficer.yearsInPositionLevel != null) {
    return Math.max(0, Math.floor(eligibilityOfficer.yearsInPositionLevel));
  }
  if (eligibilityOfficer.appointmentCycle != null && requiredTenureYears != null) {
    // Fall back: years since appointment cycle toward the requirement, floored.
    return null;
  }
  return null;
}

function computeRemainingTenureYears(
  eligibleNow: boolean,
  monthsUntilEligible: number | null,
  evidenceIncomplete: boolean
): number | null {
  if (evidenceIncomplete) return null;
  if (eligibleNow) return 0;
  if (monthsUntilEligible == null) return null;
  return Math.max(0, Math.ceil(monthsUntilEligible / 12));
}

function computeDisplayRemainingTenureTh(
  status: PromotionEligibilityStatus,
  remainingTenureYears: number | null,
  eligibleNow: boolean
): string | null {
  if (status === "Unknown") return "ประเมินไม่ได้";
  if (eligibleNow) return "ครบเกณฑ์แล้ว";
  if (remainingTenureYears == null) return null;
  if (remainingTenureYears <= 0) return "ครบเกณฑ์แล้ว";
  return `ประมาณ ${remainingTenureYears} ปี`;
}

/**
 * Phase 49.10: clear commander-facing reason (never uses "วาระ").
 */
function computeDisplayReasonTh(input: {
  status: PromotionEligibilityStatus;
  eligibleNow: boolean;
  currentLevel: string | null;
  targetLevel: string | null;
  requiredTenureYears: number | null;
  firstEligibleYearBe: number | null;
  overdueYears: number | null;
  remainingTenureYears: number | null;
  yearsHeld: number | null;
  confidenceReasonTh: string | null;
  waitingReasonTh: string | null;
}): string | null {
  const {
    status,
    eligibleNow,
    currentLevel,
    targetLevel,
    requiredTenureYears,
    firstEligibleYearBe,
    overdueYears,
    remainingTenureYears,
    yearsHeld,
    confidenceReasonTh,
    waitingReasonTh,
  } = input;

  if (status === "Unknown") return confidenceReasonTh;

  if (eligibleNow && overdueYears != null && overdueYears > 0 && firstEligibleYearBe != null) {
    return `ครบคุณสมบัติตั้งแต่ พ.ศ. ${firstEligibleYearBe} และรอการพิจารณามาแล้ว ${overdueYears} ปี`;
  }

  if (eligibleNow && requiredTenureYears != null && currentLevel && targetLevel && firstEligibleYearBe != null) {
    return `ดำรงระดับ${currentLevel}ครบเกณฑ์ ${requiredTenureYears} ปีแล้ว มีคุณสมบัติด้านระยะเวลาสำหรับการพิจารณาเลื่อนเป็น${targetLevel}ใน พ.ศ. ${firstEligibleYearBe}`;
  }

  if (
    !eligibleNow &&
    requiredTenureYears != null &&
    currentLevel &&
    yearsHeld != null &&
    remainingTenureYears != null &&
    remainingTenureYears > 0
  ) {
    return `ดำรงระดับ${currentLevel}มาแล้ว ${yearsHeld} ปี จากเกณฑ์ ${requiredTenureYears} ปี เหลืออีกประมาณ ${remainingTenureYears} ปี`;
  }

  return waitingReasonTh ?? confidenceReasonTh;
}

/**
 * 0-100 commander-facing priority score. Higher = review sooner. Factors
 * (weights chosen to reflect what a commander would triage on first,
 * documented as a starting policy — not a regulation — and easy to retune
 * without touching callers):
 *   - already-eligible duration (up to 40 pts): longer waiting = higher
 *     priority, capped at 5 years' wait for the max.
 *   - overdue years from the appointment-cycle engine (up to 25 pts).
 *   - retirement distance (up to 20 pts): closer to retirement = more
 *     urgent to resolve one way or the other, scaled over a 3-year horizon.
 *   - missing requirements (training/documents) REDUCE priority (-10 each,
 *     floor 0 contribution) — a blocked officer needs the gap closed
 *     before a promotion decision is actionable, so they rank behind an
 *     unblocked officer who is otherwise equally overdue.
 * Returns null (not zero) when there is nothing to prioritize (Unknown
 * status — no position level to evaluate at all).
 */
function computePromotionPriority(
  status: PromotionEligibilityStatus,
  yearsEligible: number | null,
  overdueYears: number | null,
  retirementRemainingMonths: number | null,
  hasMissingTraining: boolean,
  hasMissingDocuments: boolean
): { priority: number | null; priorityReason: string | null } {
  if (status === "Unknown") return { priority: null, priorityReason: null };

  const reasons: string[] = [];
  let score = 0;

  if (yearsEligible != null && yearsEligible > 0) {
    const waitedPoints = Math.min(40, Math.round((yearsEligible / 5) * 40));
    score += waitedPoints;
    reasons.push(`Eligible for ${yearsEligible} year${yearsEligible === 1 ? "" : "s"}`);
  }

  if (overdueYears != null && overdueYears > 0) {
    const overduePoints = Math.min(25, overdueYears * 12.5);
    score += overduePoints;
    reasons.push(`Overdue ${overdueYears} year${overdueYears === 1 ? "" : "s"}`);
  }

  if (retirementRemainingMonths != null && retirementRemainingMonths >= 0) {
    const horizonMonths = 36;
    const urgency = Math.max(0, Math.min(20, Math.round(((horizonMonths - retirementRemainingMonths) / horizonMonths) * 20)));
    if (urgency > 0) {
      score += urgency;
      reasons.push(`Retiring within ${Math.ceil(retirementRemainingMonths / 12)} year${Math.ceil(retirementRemainingMonths / 12) === 1 ? "" : "s"}`);
    }
  }

  if (hasMissingTraining) {
    score -= 10;
    reasons.push("Blocked by missing training");
  }
  if (hasMissingDocuments) {
    score -= 10;
    reasons.push("Blocked by missing documents");
  }

  const priority = Math.max(0, Math.min(100, Math.round(score)));
  return { priority, priorityReason: reasons.length > 0 ? reasons.join("; ") : "No urgency factors present" };
}

/**
 * Composes the full Promotion Intelligence summary for one officer. Pure
 * function over the compact `EligibilityOfficer` shape (the same input
 * `lib/server/commander_query_service.ts` already assembles) plus the
 * already-built `OfficerIntelligenceCard` (for Phase 40A compatibility
 * fields) and the officer's retirement-remaining-months (for priority).
 *
 * `asOf` defaults to now; pass an explicit value in tests for determinism.
 */
export function computePromotionSummary(
  card: OfficerIntelligenceCard,
  eligibilityOfficer: EligibilityOfficer,
  asOf: Date = new Date()
): PromotionSummary {
  const currentLevel = normalizePositionLevel(eligibilityOfficer.positionLevel);
  const target = currentLevel === UNKNOWN_POSITION_LEVEL ? null : nextPositionLevel(currentLevel);
  const level = target ? evaluateNextLevelEligibility(eligibilityOfficer, asOf) : null;

  const currentFiscalYearBe = fiscalYearBeForDate(asOf);

  const eligibleDate = computeEligibleDate(level);
  const eligibleFiscalYearBe = eligibleDate ? fiscalYearBeForDate(eligibleDate) : null;
  const firstEligibleDate = computeFirstEligibleDate(level);
  const firstEligibleYearBe = firstEligibleDate ? calendarYearBeFromDate(firstEligibleDate) : null;
  const firstEligibleFiscalYearBe = firstEligibleDate ? fiscalYearBeForDate(firstEligibleDate) : null;

  const durationResult = computeExactDuration(eligibleDate, asOf, "MISSING_SERVICE_START_DATE");
  const eligibleDuration = durationResult.available ? durationResult.duration : null;

  const missingCodes = level?.missingRequirements.map((requirement) => requirement.code) ?? [];
  const hasMissingTraining = missingCodes.some((code) => code.startsWith("TRAINING_"));
  const hasMissingDocuments = missingCodes.some((code) => code.startsWith("DOCUMENT_"));

  const promotionStatus = classifyStatus(level, eligibleFiscalYearBe, currentFiscalYearBe);

  const yearsEligibleWhole = eligibleDuration ? eligibleDuration.years : null;
  const promotionCyclesPassed = computePromotionCyclesPassed(level);
  const requiredTenureYears = target ? policyForTargetLevel(target)?.minYearsInPositionLevel ?? null : null;
  const waitingReasonTh = computeWaitingReasonTh(level);
  const { confidence, confidenceReasonTh, missingEvidence } = computeConfidence(level);

  const eligibleNow = level?.eligibleNow ?? card.promotionResult?.eligible ?? false;
  const remainingTenureYears = computeRemainingTenureYears(
    eligibleNow,
    level?.monthsUntilEligible ?? null,
    level?.evidenceIncomplete ?? false
  );
  const displayRemainingTenureTh = computeDisplayRemainingTenureTh(promotionStatus, remainingTenureYears, eligibleNow);
  const yearsHeld = yearsHeldApprox(eligibilityOfficer, requiredTenureYears);
  const displayReasonTh = computeDisplayReasonTh({
    status: promotionStatus,
    eligibleNow,
    currentLevel: currentLevel === UNKNOWN_POSITION_LEVEL ? null : currentLevel,
    targetLevel: level?.targetLevel ?? target ?? null,
    requiredTenureYears,
    firstEligibleYearBe,
    overdueYears: level?.overdueYears ?? null,
    remainingTenureYears,
    yearsHeld,
    confidenceReasonTh,
    waitingReasonTh,
  });

  const { priority, priorityReason } = computePromotionPriority(
    promotionStatus,
    yearsEligibleWhole,
    level?.overdueYears ?? null,
    eligibilityOfficer.retirementRemainingMonths,
    hasMissingTraining,
    hasMissingDocuments
  );

  return {
    // Phase 40A compatibility — unchanged meaning, now actually computed.
    status: card.promotionStatus,
    eligibleNow,
    monthsUntilEligible: level?.monthsUntilEligible ?? null,
    overdueYears: level?.overdueYears ?? null,
    eligibleYearOrdinal: level != null && level.eligibleYearOrdinal > 0 ? level.eligibleYearOrdinal : null,
    targetLevel: level?.targetLevel ?? target ?? null,

    available: true,

    currentRank: eligibilityOfficer.currentRank,
    currentPosition: currentLevel === UNKNOWN_POSITION_LEVEL ? null : currentLevel,
    targetRank: level?.targetLevel ?? target ?? null,
    targetPosition: level?.targetLevel ?? target ?? null,

    promotionStatus,

    eligibleDate: eligibleDate ? eligibleDate.toISOString().slice(0, 10) : null,
    eligibleFiscalYearBe,
    firstEligibleDate: firstEligibleDate ? firstEligibleDate.toISOString().slice(0, 10) : null,
    firstEligibleYearBe,
    firstEligibleFiscalYearBe,

    yearsEligible: yearsEligibleWhole,
    monthsEligible: eligibleDuration ? eligibleDuration.months : null,
    daysEligible: eligibleDuration ? eligibleDuration.days : null,

    promotionCyclesPassed,

    displayEligibleSinceTh: eligibleDate
      ? `ครบคุณสมบัติครั้งแรกเมื่อ ${formatFullThaiDateTh(eligibleDate)} (ปีงบประมาณที่ครบ ${eligibleFiscalYearBe}) ` +
        `มีคุณสมบัติครบมาแล้ว ${formatExactDurationTh(eligibleDuration)}` +
        (promotionCyclesPassed != null && promotionCyclesPassed > 0
          ? ` ผ่านรอบแต่งตั้งประมาณ ${promotionCyclesPassed} รอบ`
          : "")
      : null,
    displayStatusTh: PROMOTION_STATUS_DISPLAY_TH[promotionStatus],
    displayReasonTh,
    remainingTenureYears,
    displayRemainingTenureTh,

    requiredTenureYears,
    waitingReasonTh,

    confidence,
    confidenceReasonTh,
    missingEvidence,

    priority,
    priorityReason,
  };
}
