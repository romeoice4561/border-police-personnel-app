/**
 * Commander Dashboard View Model types (Phase 42 — Commander Dashboard
 * Intelligence).
 *
 * Pure type declarations only — no logic, no I/O, no React. These are the
 * shapes `lib/server/commander_dashboard_service.ts` produces by composing
 * EXISTING Intelligence Engine outputs (`PromotionSummary` from
 * lib/intelligence/promotion, `AgeSummary`/`RetirementSummary` from
 * lib/intelligence/{age,retirement}) — the Dashboard UI renders these
 * directly and never recalculates promotion/age/retirement/fiscal-year
 * logic itself. See docs/COMMANDER_DASHBOARD_INTELLIGENCE.md.
 */

import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { TrainingPriorityOfficer } from "@/lib/intelligence/training/priority";

/**
 * One officer row in the Promotion Priority list
 * ("ผู้ควรได้รับการพิจารณาก่อน"). Every field is display-ready — sourced
 * from PromotionSummary (+ Service/Retirement Intelligence for the
 * service-years/retirement-year columns), never recalculated by the UI.
 *
 * `priority`/`priorityReason` are KEPT on this type for backward
 * compatibility (Phase 42 UI refinement removed them from the table
 * display only — the priority score already determined the sort order,
 * which is unchanged) — a future consumer that still wants the raw score/
 * explanation can read them; the table component just doesn't render them.
 */
export interface PromotionCandidateViewModel {
  officerId: string;
  displayName: string;
  rank: string | null;
  currentPosition: string | null;
  currentUnit: string | null;
  /** @deprecated gallery/legacy thumbnail — kept for backward compatibility. Use officialPortraitUrl for display (Phase 42 UI refinement: the priority list must show the Official Portrait, never a gallery thumbnail). */
  thumbnailUrl: string | null;
  /** The officer's resolved Official Portrait (lib/server/officer_portrait_service.ts's single sanctioned resolver) — null when no trusted portrait exists (renders a fallback avatar, never a gallery thumbnail). */
  officialPortraitUrl: string | null;
  promotionStatus: PromotionEligibilityStatus;
  displayStatusTh: string;
  /** @deprecated verbose sentence form, kept for backward compatibility. Use displayEligibleFirstCycleTh for the table's compact display. "ครบคุณสมบัติครั้งแรกเมื่อ ..." — null when eligibleDate is unavailable. */
  displayEligibleSinceTh: string | null;
  /** "1 ต.ค. 2568" — 1 October of the FIRST eligible fiscal year (eligibleFiscalYearBe), via the existing fiscalYearStart primitive. Null when eligibleFiscalYearBe is unavailable. Never January or another arbitrary date. */
  displayEligibleFirstCycleTh: string | null;
  /** "(ปีงบประมาณ 2568)" — the fiscal year label paired with displayEligibleFirstCycleTh. Null when unavailable. */
  displayEligibleFiscalYearTh: string | null;
  /** @deprecated verbose duration ("20 ปี 8 เดือน 15 วัน"), kept for backward compatibility. Use promotionYearOrdinal ("ปีนี้เป็นปีที่ N") for the table's compact display. */
  displayEligibleDurationTh: string | null;
  /**
   * "ปีนี้เป็นปีที่ N" — which numbered year of eligibility this is (1 = the
   * officer's first eligible year). Sourced directly from
   * PromotionSummary.eligibleYearOrdinal — no new calculation here. Null
   * when the officer is not yet eligible.
   */
  promotionYearOrdinal: number | null;
  promotionCyclesPassed: number | null;
  /** @deprecated "รอบที่ N" cycle-count label — Commander Promotion UX refinement replaces this column with displayYearsAtLevelTh ("ดำรงตำแหน่งระดับนี้มา"). Kept for backward compatibility; sourced from promotionCyclesPassed. */
  displayPromotionCycleTh: string | null;
  /** "16 ปี 1 เดือน 3 วัน" — exact government-service duration, from Service Intelligence (lib/intelligence/service). Never decimal. Null when unavailable. */
  displayServiceDurationTh: string | null;
  /** Buddhist-Era retirement fiscal year, e.g. 2588 — from Retirement Intelligence. Null when unavailable. */
  retirementYearBe: number | null;
  /** "พ.ศ. 2588" — the retirement-year table cell text. Null when unavailable. */
  displayRetirementYearTh: string | null;
  /**
   * "ครบขึ้น ผกก." — answers "ครบขึ้นตำแหน่งอะไร" (which position level the
   * officer would advance into), not a generic "Eligible" label. Built from
   * PromotionSummary.targetPosition (unchanged/unmodified) — the officer's
   * NEXT position level, one level above their current one. Null when
   * targetPosition is unavailable (e.g. Unknown level, or already at the
   * top of scope).
   */
  displayTargetQualificationTh: string | null;
  /**
   * "5 ปี" — how many years the officer has held their CURRENT position
   * level (`ดำรงตำแหน่งระดับนี้มา` — "how long have they been at this
   * level", NOT a promotion-cycle count). Whole years only. Sourced from
   * Service/tenure data already computed upstream
   * (CommanderQueryOfficer.yearsInPositionLevel), never recalculated here.
   * Null when unavailable.
   */
  displayYearsAtLevelTh: string | null;
  /** 0-100. This list only ever includes officers with a non-null priority (Unknown-status officers are excluded — see PromotionSummary's documented null-when-Unknown convention). Not rendered in the table (Phase 42 UI refinement — the priority score already determined sort order); kept for compatibility/future use. */
  priority: number;
  /** @deprecated not rendered in the table as of Phase 42's UI refinement — kept for backward compatibility. */
  priorityReason: string | null;
  /** Link to the officer's profile — "ดูประวัติ". */
  href: string;
}

/** One officer row in the Birthday Intelligence lists. Sourced from AgeSummary — never a locally-computed age. */
export interface BirthdayOfficerViewModel {
  officerId: string;
  displayName: string;
  rank: string | null;
  position: string | null;
  unit: string | null;
  profileImageUrl: string | null;
  /** ISO date (YYYY-MM-DD), Gregorian — internal/technical value. */
  birthDate: string;
  /** ISO date (YYYY-MM-DD) of this officer's next birthday occurrence (AgeSummary.nextBirthdayDate). */
  birthdayDateThisYear: string;
  turningAge: number;
  daysUntilBirthday: number;
  /** "25 ก.ค. 2569" */
  displayBirthdayTh: string;
  /** "ครบ 41 ปี วันนี้" / "ครบ 38 ปี ในอีก 3 วัน" */
  displayTurningAgeTh: string;
}

/** One officer row in the Retirement Awareness drill-down list. Sourced from RetirementSummary — never a locally-computed retirement date. */
export interface RetirementOfficerViewModel {
  officerId: string;
  displayName: string;
  rank: string | null;
  currentUnit: string | null;
  /** "40 ปี 11 เดือน 6 วัน" — exact age, from AgeSummary. Null when age is unavailable. */
  displayAgeTh: string | null;
  /** Whole days until retirement (RetirementSummary.remainingDays) — the technical value the UI filters "within N years" tabs on; never rendered directly (use displayRemainingTh). */
  remainingDays: number;
  /** "30 กันยายน 2588" */
  displayRetirementDateTh: string;
  /** "ปีงบประมาณ 2588" */
  displayRetirementYearTh: string;
  /** "5 ปี 2 เดือน 10 วัน" or "เกษียณแล้ว" */
  displayRemainingTh: string;
  promotionStatus: PromotionEligibilityStatus | null;
  displayPromotionStatusTh: string | null;
  href: string;
}

export type CommanderActionCategory = "PROMOTION_PRIORITY" | "RETIREMENT" | "DATA_QUALITY" | "BIRTHDAY" | "TRAINING" | "DOCUMENT_EXPIRY_FUTURE";
export type CommanderActionSeverity = "high" | "medium" | "info";

export interface CommanderActionItemViewModel {
  id: string;
  category: CommanderActionCategory;
  severity: CommanderActionSeverity;
  title: string;
  description: string;
  count: number;
  href: string | null;
}

export interface CommanderDashboardViewModel {
  /** ISO date (YYYY-MM-DD) the view model was computed. */
  generatedAt: string;
  fiscalYearBe: number;
  displayFiscalYearTh: string;

  personnelOverview: {
    totalPersonnel: number;
    activePersonnel: number;
    /** Officers whose age/retirement data cannot be computed (missing/invalid dateOfBirth) — never silently folded into a zero. */
    dataUnavailableCount: number;
  };

  promotion: {
    eligibleThisYear: number;
    alreadyEligible: number;
    waiting: number;
    missingTraining: number;
    missingDocuments: number;
    retirementRestricted: number;
    unknown: number;
    priorityCandidates: PromotionCandidateViewModel[];
  };

  birthdays: {
    todayCount: number;
    nextSevenDaysCount: number;
    thisMonthCount: number;
    today: BirthdayOfficerViewModel[];
    nextSevenDays: BirthdayOfficerViewModel[];
    thisMonth: BirthdayOfficerViewModel[];
  };

  retirement: {
    withinOneYear: number;
    withinThreeYears: number;
    withinFiveYears: number;
    candidates: RetirementOfficerViewModel[];
  };

  /**
   * Phase 45 (Training Intelligence Engine). Every count here is sourced
   * from TrainingSummary.trainingStatus per officer — truthful, never a
   * fabricated zero. `noPolicyCount` is reported SEPARATELY from
   * `missingRequiredCount` — a NoPolicy officer is never counted as
   * MissingRequired. Since no real TrainingPolicy is configured today (see
   * docs/TRAINING_INTELLIGENCE.md), `missingRequiredCount`/`expiredCount`/
   * `expiringSoonCount` are structurally 0 for every officer and
   * `noPolicyCount` equals the officer total (or `noDataCount` for officers
   * with zero training records) — this is the truthful state, not a bug.
   */
  training: {
    missingRequiredCount: number;
    expiredCount: number;
    expiringSoonCount: number;
    unverifiedCount: number;
    noPolicyCount: number;
    noDataCount: number;
    /** Officers whose TrainingSummary itself could not be loaded (distinct from NoData/NoPolicy — always 0 today, kept honest rather than folded into NoData). */
    unavailableCount: number;
    /** True only when at least one officer's target level has a real configured TrainingPolicy — drives whether the KPI card may link to a Commander Search training filter. */
    policyConfigured: boolean;
    /** Deterministic, rule-ordered priority list (Task 12) — not an AI recommendation, not a numerical score. */
    priorityOfficers: TrainingPriorityOfficer[];
  };

  actionCenter: CommanderActionItemViewModel[];
}
