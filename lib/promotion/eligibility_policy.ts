/**
 * Configurable, policy-driven promotion-to-position-level eligibility
 * (Phase 41 Parts 2–4).
 *
 * The existing promotion engine (lib/promotion) evaluates a set of composable
 * rules against a broad context and returns a structured pass/fail result. It
 * intentionally does NOT hardcode which rules apply to which promotion — that
 * policy lives HERE, as DATA (`PROMOTION_POLICIES`), so a future policy change
 * (a different minimum tenure, an added required document, a new target level)
 * is a config edit, never an engine rewrite. This module:
 *
 *   1. Declares, per TARGET position level, the requirements to advance INTO
 *      it (current level below it, minimum years in the current level / rank /
 *      government service, retirement window, required training/documents,
 *      salary-step history) — every field optional so a policy can be as
 *      strict or loose as needed and NEW requirement kinds can be appended
 *      without touching existing policies.
 *   2. Builds the engine's PromotionRule[] from a policy and evaluates it —
 *      reusing the engine's rule factories, never duplicating their logic.
 *   3. Adds the temporal projection the engine's boolean result can't express
 *      on its own: eligible NOW / eligible WITHIN N months / OVERDUE by X
 *      years, plus the missing requirements and recommended next actions the
 *      engine already produces.
 *
 * The input is a compact `EligibilityOfficer` — exactly the fields the
 * Commander read model already computes (lib/commander_query) — so Commander
 * Search, Dashboard, Statistics and Reports all evaluate eligibility through
 * this one function and get identical answers, with no database or React
 * dependency here. Pure logic.
 */

import {
  createMinimumRankRule,
  createMinimumServiceRule,
  createRequiredDocumentsRule,
  createRequiredTrainingRule,
  createRetirementWindowRule,
  evaluatePromotionEligibility,
  type PromotionEvaluationContext,
  type PromotionNextStep,
  type PromotionRequirement,
  type PromotionRule,
} from "@/lib/promotion";
import {
  POSITION_LEVEL_ORDER,
  RANKED_POSITION_LEVELS,
  UNKNOWN_POSITION_LEVEL,
  nextPositionLevel,
  normalizePositionLevel,
  type PositionLevel,
} from "@/lib/commander_query/position_level";
import { currentPromotionCycle, evaluatePromotionCycle, type PromotionCycleResult } from "@/lib/promotion_cycle";
import { addYears, compareDates } from "@/lib/personnel_calendar";

/**
 * A promotion policy for advancing INTO `targetLevel`. Every requirement is
 * optional; omit a field and that requirement simply isn't checked. Add a new
 * OPTIONAL field here (and a corresponding rule in `buildRulesForPolicy`) to
 * introduce a new requirement kind without breaking existing policies, data,
 * searches, charts, or reports.
 */
export interface PromotionPolicy {
  targetLevel: Exclude<PositionLevel, typeof UNKNOWN_POSITION_LEVEL>;
  /** Ranks accepted as the current rank for this promotion (empty/omitted = any). */
  eligibleFromRanks?: readonly string[];
  /** Minimum whole years the officer must have held their CURRENT position level. */
  minYearsInPositionLevel?: number;
  /** Minimum whole years in the current rank. */
  minYearsInRank?: number;
  /** Minimum whole years of government service. */
  minGovernmentServiceYears?: number;
  /** Officer must have at least this many months remaining before retirement. */
  minRetirementRemainingMonths?: number;
  /** Training course codes that must all be completed. */
  requiredTrainingCodes?: readonly string[];
  /** Document type codes that must all be present/active. */
  requiredDocumentCodes?: readonly string[];
  /**
   * Salary-step history requirement: the officer must have received at least
   * `minTwoStepCount` two-step (2.0) results across their salary history. 0 or
   * omitted = not checked. (Reuses the salary-step data the read model already
   * carries; no new engine logic.)
   */
  minTwoStepCount?: number;
}

/** The compact officer shape this layer evaluates — a subset of the Commander read model. Framework/DB-free. */
export interface EligibilityOfficer {
  currentRank: string | null;
  positionLevel: string | null;
  yearsInPositionLevel: number | null;
  yearsInRank: number | null;
  governmentServiceYears: number | null;
  retirementRemainingMonths: number | null;
  trainingCodes: readonly string[];
  documentCodes: readonly string[];
  twoStepCount: number;
  appointmentCycle?: number | null;
  /**
   * Exact effective start date of the current position level (Timeline-derived).
   * When present, position-level tenure also requires `asOf >= addYears(start, minYears)`.
   * Year-only Timeline rows typically resolve to 1 January of that BE year.
   */
  positionLevelStartedAt?: Date | null;
}

export type EligibilityStatus =
  | "eligible_now"
  | "eligible_soon"
  | "overdue"
  | "not_eligible";

/**
 * Phase 49.8: stable, serializable keys naming WHICH canonical evidence is
 * missing — never long Thai display text (the UI translates these; see
 * lib/intelligence/promotion/missing_evidence_labels.ts). Reused across
 * PromotionSummary/DTOs/tool output so every consumer names gaps the same
 * way. Deliberately closed and small — one key per canonical evidence
 * source this engine actually depends on, not a generic error-code list.
 */
export type MissingEvidenceKey =
  | "current_rank_start_date"
  | "current_position_level_start_date"
  | "promotion_policy"
  | "training_data"
  | "document_data"
  | "retirement_data";

export interface LevelEligibilityResult {
  targetLevel: PositionLevel;
  status: EligibilityStatus;
  /** True for both eligible_now and overdue (the officer meets every blocking requirement today). */
  eligibleNow: boolean;
  /** Whole months until the officer's tenure requirements are met (0 when already met; null when unknowable, e.g. a non-tenure blocker). */
  monthsUntilEligible: number | null;
  /**
   * Completed waiting years after first becoming eligible — NOT a year ordinal.
   * First eligible cycle = 0; after one full completed appointment cycle = 1.
   * Always 0 when not eligible. Distinct from `eligibleYearOrdinal`.
   */
  overdueYears: number;
  /**
   * One-based eligibility-year ordinal (ปีที่ N / รอบที่ N).
   * First eligible cycle = 1; second = 2. Always 0 when not eligible.
   * Sourced from PromotionCycleResult.overdueCycles (engine 1-based ordinal).
   */
  eligibleYearOrdinal: number;
  promotionCycle: PromotionCycleResult | null;
  /**
   * Exact first-eligible calendar date when `positionLevelStartedAt` + policy
   * years are known (`addYears(start, minYearsInPositionLevel)`). Null when
   * only the appointment-cycle year projection is available.
   */
  exactFirstEligibleDate: Date | null;
  missingRequirements: PromotionRequirement[];
  recommendedActions: PromotionNextStep[];
  score: number;
  maxScore: number;
  /**
   * Phase 49.8: true when at least one MANDATORY tenure requirement
   * (position-level or rank) could not be evaluated because its start-date
   * evidence is missing — distinct from a requirement that WAS evaluated
   * and found short. When true, `eligibleNow`/`overdueYears`/`status` must
   * never report a confirmed positive result (see classifyStatus) — the
   * honest answer is "not assessable," not "not eligible."
   */
  evidenceIncomplete: boolean;
  /** Stable keys for every piece of missing evidence that blocked a full assessment. Empty when evidenceIncomplete is false. */
  missingEvidence: MissingEvidenceKey[];
}

/** How far ahead (in months) still counts as "eligible soon" rather than "not eligible". */
export const ELIGIBLE_SOON_HORIZON_MONTHS = 12;

/**
 * The default BPP promotion policies, keyed by target level. Deliberately
 * DATA: tune a number here and every consumer's eligibility shifts with no
 * code change. Tenure minimums are placeholders a commander can adjust; the
 * ENGINE never assumes any particular value.
 *
 * Phase 49.7: `minYearsInPositionLevel` for รอง สว. → สารวัตร corrected from
 * 4 to 7 — confirmed by a reported officer whose position-level start date
 * (1 ก.พ. 2567) and profile were used to trace the exact policy value that
 * produced an incorrect "already eligible" result 3 years early (should be
 * eligible in BE 2574, not 2571 — see the regression tests in
 * lib/intelligence/promotion/__tests__/promotion_intelligence.test.ts and
 * lib/promotion/__tests__/eligibility_policy.test.ts).
 *
 * Phase 49.9: `minYearsInPositionLevel` for สารวัตร → รองผู้กำกับการ
 * corrected from 4 to 5 — confirmed by a reported profile that showed
 * required tenure 4 / first eligible 2568 / overdue 1 for a สารวัตร start
 * in พ.ศ. 2564 (canonical: 5 years → first eligible พ.ศ. 2569, overdue 0 /
 * รอบที่ 1 in the first eligible cycle). Every OTHER level's
 * minYearsInPositionLevel is UNCHANGED unless explicitly confirmed wrong.
 */
export const PROMOTION_POLICIES: readonly PromotionPolicy[] = [
  { targetLevel: "สารวัตร", minYearsInPositionLevel: 7, minYearsInRank: 4 },
  { targetLevel: "รองผู้กำกับการ", minYearsInPositionLevel: 5, minYearsInRank: 4 },
  { targetLevel: "ผู้กำกับการ", minYearsInPositionLevel: 4, minYearsInRank: 4 },
  { targetLevel: "รองผู้บังคับการ", minYearsInPositionLevel: 4, minYearsInRank: 3 },
  { targetLevel: "ผู้บังคับการ", minYearsInPositionLevel: 4, minYearsInRank: 3 },
  { targetLevel: "รองผู้บัญชาการ", minYearsInPositionLevel: 4, minYearsInRank: 3 },
];

const POLICY_BY_LEVEL = new Map<string, PromotionPolicy>(PROMOTION_POLICIES.map((p) => [p.targetLevel, p]));

/** The policy for advancing INTO `targetLevel`, or null if none is configured. */
export function policyForTargetLevel(targetLevel: string): PromotionPolicy | null {
  return POLICY_BY_LEVEL.get(targetLevel) ?? null;
}

/** The target levels that have a configured policy, lowest → highest — used to build summary cards / target dropdowns. */
export const PROMOTION_TARGET_LEVELS: readonly PositionLevel[] = RANKED_POSITION_LEVELS.filter((level) =>
  POLICY_BY_LEVEL.has(level)
);

function years(value: number | null | undefined): { years: number; months: number; days: number } {
  const v = Math.max(0, value ?? 0);
  const whole = Math.floor(v);
  const months = Math.floor((v - whole) * 12);
  return { years: whole, months, days: 0 };
}

/**
 * Builds the engine's rules from a policy. Each configured requirement maps to
 * exactly one existing engine rule factory (no duplicated logic); an omitted
 * requirement contributes no rule. `minYearsInPositionLevel` reuses the
 * minimum-SERVICE rule against a context whose `governmentServiceDuration` we
 * temporarily set to the officer's time-in-level (see evaluateLevelEligibility)
 * — the rule is a generic "duration ≥ minimum" check, so this is composition,
 * not modification.
 */
function buildRulesForPolicy(policy: PromotionPolicy): PromotionRule[] {
  const rules: PromotionRule[] = [];
  if (policy.eligibleFromRanks && policy.eligibleFromRanks.length > 0) {
    rules.push(createMinimumRankRule({ id: "eligible-rank", allowedRanks: policy.eligibleFromRanks }));
  }
  if (policy.minGovernmentServiceYears != null) {
    rules.push(createMinimumServiceRule({ id: "min-service", minimum: years(policy.minGovernmentServiceYears) }));
  }
  if (policy.minRetirementRemainingMonths != null) {
    rules.push(createRetirementWindowRule({ id: "retirement-window", minimumRemainingMonths: policy.minRetirementRemainingMonths }));
  }
  if (policy.requiredTrainingCodes && policy.requiredTrainingCodes.length > 0) {
    rules.push(createRequiredTrainingRule({ id: "required-training", requiredTrainingCodes: policy.requiredTrainingCodes }));
  }
  if (policy.requiredDocumentCodes && policy.requiredDocumentCodes.length > 0) {
    rules.push(createRequiredDocumentsRule({ id: "required-documents", requiredDocumentTypes: policy.requiredDocumentCodes }));
  }
  return rules;
}

/** Monthly gap between an actual whole-year tenure and a required whole-year minimum (0 when already met, null when the actual is unknown). */
function monthsShortfall(actualYears: number | null, requiredYears: number | undefined): number | null {
  if (requiredYears == null) return 0;
  if (actualYears == null) return null;
  const diffMonths = Math.round((requiredYears - actualYears) * 12);
  return Math.max(0, diffMonths);
}

/**
 * Evaluates whether `officer` is eligible to advance into `targetLevel` under
 * the configured policy. Delegates the blocking pass/fail + missing
 * requirements to the promotion engine, then layers on the temporal status
 * (now / soon / overdue) from the tenure fields.
 *
 * Returns `not_eligible` with no policy when `targetLevel` has none configured.
 */
export function evaluateLevelEligibility(
  officer: EligibilityOfficer,
  targetLevel: string,
  asOf: Date = new Date()
): LevelEligibilityResult {
  const normalizedTarget = normalizePositionLevel(targetLevel);
  const policy = policyForTargetLevel(normalizedTarget);
  if (!policy) {
    return {
      targetLevel: normalizedTarget,
      status: "not_eligible",
      eligibleNow: false,
      monthsUntilEligible: null,
      overdueYears: 0,
      eligibleYearOrdinal: 0,
      promotionCycle: null,
      exactFirstEligibleDate: null,
      missingRequirements: [],
      recommendedActions: [],
      score: 0,
      maxScore: 0,
      evidenceIncomplete: false,
      missingEvidence: [],
    };
  }
  return evaluateWithPolicy(officer, policy, asOf);
}

/**
 * Evaluates an officer against an EXPLICIT policy object (rather than looking
 * one up by target level). This is the core evaluator — `evaluateLevelEligibility`
 * is a thin lookup wrapper over it. Exported so a caller (or a test) can drive
 * a custom/experimental policy through the exact same logic, demonstrating
 * that requirements are pure DATA the engine honors without code changes.
 */
export function evaluateWithPolicy(
  officer: EligibilityOfficer,
  policy: PromotionPolicy,
  asOf: Date = new Date()
): LevelEligibilityResult {
  const normalizedTarget = policy.targetLevel as PositionLevel;
  const currentLevel = normalizePositionLevel(officer.positionLevel);

  const base: Omit<
    LevelEligibilityResult,
    | "status"
    | "eligibleNow"
    | "monthsUntilEligible"
    | "overdueYears"
    | "eligibleYearOrdinal"
    | "promotionCycle"
    | "exactFirstEligibleDate"
  > = {
    targetLevel: normalizedTarget,
    missingRequirements: [],
    recommendedActions: [],
    score: 0,
    maxScore: 0,
    evidenceIncomplete: false,
    missingEvidence: [],
  };

  // The target must be exactly one level above the officer's current level —
  // you are "eligible to advance to the NEXT level", never to skip levels.
  const expectedTarget = currentLevel === UNKNOWN_POSITION_LEVEL ? null : nextPositionLevel(currentLevel);
  const levelAdjacent = expectedTarget === normalizedTarget;

  if (!levelAdjacent) {
    return {
      ...base,
      missingRequirements: [
        {
          code: "CURRENT_LEVEL",
          label: "ระดับตำแหน่งปัจจุบันต้องอยู่ต่ำกว่าระดับเป้าหมายหนึ่งขั้น",
          detail: `${normalizedTarget}`,
        },
      ],
      status: "not_eligible",
      eligibleNow: false,
      monthsUntilEligible: null,
      overdueYears: 0,
      eligibleYearOrdinal: 0,
      promotionCycle: null,
      exactFirstEligibleDate: null,
    };
  }

  // Non-tenure rules go through the engine (rank / training / documents /
  // retirement window). Tenure rules (years in level/rank/service) are checked
  // directly below so we can ALSO compute the temporal projection from the
  // exact shortfall — the engine only returns a boolean. buildPromotionContext
  // derives age/service durations from dates, so we pass the retirement
  // remaining duration directly and rely on the tenure block below for the
  // year-count checks.
  const rules = buildRulesForPolicy(policy).filter((rule) => rule.id !== "min-service");
  // Built directly (not via buildPromotionContext) because we carry the
  // officer's ALREADY-COMPUTED retirement-remaining duration, not a birth date
  // to derive it from — the read model did that math once, upstream.
  const context: PromotionEvaluationContext = {
    asOf,
    currentRank: officer.currentRank,
    trainingRecords: officer.trainingCodes.map((code) => ({ code })),
    documents: officer.documentCodes.map((typeCode) => ({ typeCode, isActive: true })),
    remainingUntilRetirement:
      officer.retirementRemainingMonths == null
        ? null
        : { years: Math.floor(officer.retirementRemainingMonths / 12), months: officer.retirementRemainingMonths % 12, days: 0 },
    extensions: { targetLevel: normalizedTarget },
  };
  const engineResult = rules.length > 0 ? evaluatePromotionEligibility(context, rules) : null;
  const cycle =
    policy.minYearsInPositionLevel != null
      ? evaluatePromotionCycle({
          appointmentCycle: officer.appointmentCycle,
          currentCycle: currentPromotionCycle(asOf),
          policy: { requiredCycles: policy.minYearsInPositionLevel },
        })
      : null;

  // Tenure requirements (checked directly against the numeric fields so we can
  // also compute the temporal projection). Each contributes a missing
  // requirement + recommended action when unmet.
  const missing: PromotionRequirement[] = engineResult ? [...engineResult.missingRequirements] : [];
  const actions: PromotionNextStep[] = engineResult ? [...engineResult.suggestedNextSteps] : [];

  // Exact calendar first-eligible date when Timeline day/month/year is known.
  // Year-only rows resolve to 1 January of that BE year via toEffectiveDate.
  const exactFirstEligibleDate =
    officer.positionLevelStartedAt != null && policy.minYearsInPositionLevel != null
      ? addYears(officer.positionLevelStartedAt, policy.minYearsInPositionLevel)
      : null;
  const exactDatePending =
    exactFirstEligibleDate != null && compareDates(asOf, exactFirstEligibleDate) < 0;

  const levelShortfall =
    policy.minYearsInPositionLevel != null
      ? cycle?.appointmentCycle == null
        ? null
        : cycle.eligibleNow && !exactDatePending
          ? 0
          : exactDatePending && exactFirstEligibleDate
            ? Math.max(
                0,
                (exactFirstEligibleDate.getUTCFullYear() - asOf.getUTCFullYear()) * 12 +
                  (exactFirstEligibleDate.getUTCMonth() - asOf.getUTCMonth())
              )
            : Math.max(0, ((cycle.eligibleCycle ?? currentPromotionCycle(asOf)) - currentPromotionCycle(asOf)) * 12)
      : 0;
  const rankShortfall = monthsShortfall(officer.yearsInRank, policy.minYearsInRank);
  const serviceShortfallYears =
    policy.minGovernmentServiceYears != null && officer.governmentServiceYears != null
      ? Math.max(0, policy.minGovernmentServiceYears - officer.governmentServiceYears)
      : 0;

  // Phase 49.8: a tenure check can fail for two DIFFERENT reasons — a real,
  // confirmed shortfall (the officer genuinely hasn't held the level/rank
  // long enough) or missing start-date EVIDENCE (we simply don't know how
  // long they've held it). Both used to collapse into the same
  // `tenureBlocked = true` -> "not eligible"/"waiting" result. They are now
  // tracked separately: `evidenceIncomplete`/`missingEvidence` let
  // classifyStatus() (lib/intelligence/promotion/index.ts) route an
  // evidence gap to "Unknown"/"not assessable" instead of a confirmed
  // negative result, per the same "no fabricated eligibility" principle
  // Phase 49.7 already applied to eligibleDate.
  let tenureBlocked = false;
  let evidenceIncomplete = false;
  const missingEvidence: MissingEvidenceKey[] = [];
  if (policy.minYearsInPositionLevel != null) {
    if (cycle?.appointmentCycle == null) {
      tenureBlocked = true;
      evidenceIncomplete = true;
      missingEvidence.push("current_position_level_start_date");
      missing.push({
        code: "MISSING_APPOINTMENT_CYCLE",
        label: "ต้องมีรอบแต่งตั้งใน Career Timeline",
        detail: "ไม่มีข้อมูล",
      });
      actions.push({ code: "ADD_APPOINTMENT_CYCLE", label: "เพิ่มรอบแต่งตั้งใน Career Timeline" });
    } else if (!cycle.eligibleNow || exactDatePending) {
      tenureBlocked = true;
      missing.push({
        code: "MIN_CYCLES_IN_LEVEL",
        label: `ดำรงระดับตำแหน่งปัจจุบันครบ ${policy.minYearsInPositionLevel} ปี`,
        detail: `รอบแต่งตั้ง ${cycle.appointmentCycle}, ครบเกณฑ์ปี ${cycle.eligibleCycle}`,
      });
      actions.push({ code: "WAIT_LEVEL_CYCLES", label: "รอให้ครบระยะเวลาดำรงระดับตำแหน่ง" });
    }
  }
  if (policy.minYearsInRank != null) {
    if (officer.yearsInRank == null) {
      tenureBlocked = true;
      evidenceIncomplete = true;
      missingEvidence.push("current_rank_start_date");
      missing.push({
        code: "MIN_YEARS_IN_RANK_UNKNOWN",
        label: `ไม่พบวันที่เริ่มครองยศปัจจุบัน — ไม่สามารถประเมินระยะเวลาดำรงยศครบ ${policy.minYearsInRank} ปี ได้`,
        detail: "ไม่มีข้อมูล",
      });
      actions.push({ code: "ADD_RANK_HISTORY", label: "เพิ่มข้อมูลวันที่เริ่มครองยศใน Career Timeline" });
    } else if (rankShortfall != null && rankShortfall > 0) {
      tenureBlocked = true;
      missing.push({
        code: "MIN_YEARS_IN_RANK",
        label: `ดำรงยศปัจจุบันครบ ${policy.minYearsInRank} ปี`,
        detail: `ปัจจุบัน ${officer.yearsInRank} ปี`,
      });
      actions.push({ code: "WAIT_RANK_TENURE", label: "รอให้ครบระยะเวลาการดำรงยศ" });
    }
  }
  if (serviceShortfallYears > 0) {
    tenureBlocked = true;
    missing.push({
      code: "MIN_SERVICE_YEARS",
      label: `อายุราชการครบ ${policy.minGovernmentServiceYears} ปี`,
      detail: officer.governmentServiceYears == null ? "ไม่มีข้อมูล" : `ปัจจุบัน ${officer.governmentServiceYears} ปี`,
    });
    actions.push({ code: "WAIT_SERVICE_TENURE", label: "รอให้ครบอายุราชการที่กำหนด" });
  }
  if (policy.minTwoStepCount != null && policy.minTwoStepCount > 0 && officer.twoStepCount < policy.minTwoStepCount) {
    tenureBlocked = true;
    missing.push({
      code: "MIN_TWO_STEP",
      label: `ได้รับเงินเดือน 2 ขั้น อย่างน้อย ${policy.minTwoStepCount} ครั้ง`,
      detail: `ปัจจุบัน ${officer.twoStepCount} ครั้ง`,
    });
    actions.push({ code: "SALARY_STEP_REVIEW", label: "ตรวจสอบประวัติขั้นเงินเดือน" });
  }

  const engineBlocked = engineResult ? !engineResult.eligible : false;
  const eligibleNow = !engineBlocked && !tenureBlocked;

  // Temporal projection from the tenure shortfalls (the largest gap governs).
  const shortfalls = [levelShortfall, rankShortfall, Math.round(serviceShortfallYears * 12)].filter(
    (m): m is number => m != null
  );
  const anyUnknown = [levelShortfall, rankShortfall].some((m) => m == null);
  const monthsUntilEligible = eligibleNow ? 0 : anyUnknown || engineBlocked ? null : shortfalls.length > 0 ? Math.max(...shortfalls) : null;

  // Phase 49.9 semantic split:
  //   - overdueYears = completed waiting years (yearsAfterEligibility):
  //     first eligible cycle = 0; after one completed cycle = 1.
  //   - eligibleYearOrdinal = one-based year/cycle ordinal (engine overdueCycles):
  //     first eligible cycle = 1; second = 2.
  // Never copy the engine's 1-based overdueCycles into overdueYears — that
  // conflated "ปีที่ 1" with "รอมาแล้ว 1 ปี". Also: never report a positive
  // overdueYears / ordinal unless the officer is ACTUALLY eligible now
  // (cycle math alone can ignore other blockers).
  const overdueYears =
    eligibleNow && cycle && cycle.yearsAfterEligibility != null ? cycle.yearsAfterEligibility : 0;
  const eligibleYearOrdinal = eligibleNow && cycle && cycle.overdueCycles > 0 ? cycle.overdueCycles : 0;

  let status: EligibilityStatus;
  if (eligibleNow) {
    status = overdueYears > 0 ? "overdue" : "eligible_now";
  } else if (monthsUntilEligible != null && monthsUntilEligible <= ELIGIBLE_SOON_HORIZON_MONTHS) {
    status = "eligible_soon";
  } else {
    status = "not_eligible";
  }

  return {
    ...base,
    status,
    eligibleNow,
    monthsUntilEligible,
    overdueYears,
    eligibleYearOrdinal,
    promotionCycle: cycle,
    exactFirstEligibleDate,
    missingRequirements: missing,
    recommendedActions: actions,
    score: engineResult?.score ?? 0,
    maxScore: engineResult?.maxScore ?? 0,
    evidenceIncomplete,
    missingEvidence,
  };
}

/** Convenience: evaluate the officer against the policy for the level immediately above their current one (their natural next promotion). Null when they're at Unknown or the top. */
export function evaluateNextLevelEligibility(officer: EligibilityOfficer, asOf: Date = new Date()): LevelEligibilityResult | null {
  const currentLevel = normalizePositionLevel(officer.positionLevel);
  if (currentLevel === UNKNOWN_POSITION_LEVEL) return null;
  const target = nextPositionLevel(currentLevel);
  if (!target || !policyForTargetLevel(target)) return null;
  return evaluateLevelEligibility(officer, target, asOf);
}

/** Orders levels for display (lowest → highest) using the canonical order. */
export function comparePositionLevels(a: string, b: string): number {
  return (POSITION_LEVEL_ORDER[normalizePositionLevel(a)] ?? 0) - (POSITION_LEVEL_ORDER[normalizePositionLevel(b)] ?? 0);
}
