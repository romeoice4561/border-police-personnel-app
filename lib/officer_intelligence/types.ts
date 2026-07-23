/**
 * Officer Intelligence View Model (Phase 44 — Officer Intelligence
 * Workspace).
 *
 * The single shape the Officer Profile/Workspace UI reads from — composed
 * ONCE, server-side, from the already-established Intelligence facades
 * (Age/Service/Promotion/Retirement — lib/intelligence/*) and the SAME
 * per-officer Commander read-model composition Commander Search already
 * runs (`toQueryOfficer` in lib/server/commander_query_service.ts), plus
 * the canonical Official Portrait resolver (Phase 43). No React component
 * may recalculate any of these values — see
 * docs/OFFICER_INTELLIGENCE_WORKSPACE.md.
 *
 * Pure type declarations — no logic, no I/O.
 */

import type { PromotionEligibilityStatus } from "@/lib/intelligence/shared/types";
import type { TrainingSummary } from "@/lib/intelligence/training/types";
import type { MissingEvidenceKey } from "@/lib/promotion/eligibility_policy";

export interface OfficerIntelligenceViewModel {
  /** ISO timestamp this view model was composed. */
  generatedAt: string;
  /** ISO date (YYYY-MM-DD) every calculation in this view model treats as "today" — deterministic for tests, real `new Date()` in production. */
  asOfDate: string;

  identity: {
    officerId: string;
    displayName: string;
    rank: string | null;
    position: string | null;
    positionLevel: string | null;
    unit: string | null;
    /** The ONE canonical Official Portrait URL (Phase 43 resolver). Null when no trusted portrait is linked — render a placeholder, never a gallery/document fallback. */
    officialPortraitUrl: string | null;
  };

  age: {
    available: boolean;
    displayAgeTh: string | null;
    ageYears: number | null;
    nextBirthdayDate: string | null;
    /** The age the officer turns on nextBirthdayDate, e.g. 41 — for a "ครบ 41 ปี" label. */
    nextBirthdayAge: number | null;
    daysUntilNextBirthday: number | null;
    displayNextBirthdayTh: string | null;
  };

  service: {
    available: boolean;
    serviceStartDate: string | null;
    displayServiceDurationTh: string | null;
    yearsInCurrentPositionLevel: number | null;
    currentPositionLevelStartYearBe: number | null;
  };

  promotion: {
    available: boolean;
    targetPositionTh: string | null;
    /** "ครบขึ้น {target}" — set ONLY when the officer is ALREADY eligible (promotion.eligibleNow). Null while waiting, blocked, or Unknown — a target level being computable is NOT the same as qualification being complete (Phase 49.7 fix: this previously fired whenever a target level existed, regardless of eligibility). Never render this as a generic "target exists" badge. */
    qualificationTextTh: string | null;
    /** Raw status enum — for badge-tone lookup only (PROMOTION_STATUS_TONE); never rendered directly as text. */
    status: PromotionEligibilityStatus;
    displayStatusTh: string | null;
    /** Buddhist-Era fiscal year the officer FIRST qualifies for their next level — PROJECTED, computed even before the officer reaches it (PromotionSummary.firstEligibleFiscalYearBe). Null only when the projection is not computable (Unknown level, no policy, no appointmentCycle evidence). */
    firstEligibleYearBe: number | null;
    /** ISO date matching firstEligibleYearBe — projected, same precision-limit rationale as PromotionSummary.firstEligibleDate (anchored to 1 January of the eligible Gregorian year). */
    firstEligibleDate: string | null;
    /** PROMOTION_POLICIES.minYearsInPositionLevel for the target level — from PromotionSummary.requiredTenureYears, never recomputed. Null when no policy is configured. */
    requiredTenureYears: number | null;
    /** "ดำรงระดับตำแหน่งปัจจุบันครบ N วาระ" — from PromotionSummary.waitingReasonTh, the engine's own missing-requirement label. Null when already eligible or blocked by something else. */
    waitingReasonTh: string | null;
    /** Whole promotion opportunities already missed since first becoming eligible — same "รอการแต่งตั้งมาแล้ว" semantics as Commander Search (overdueYears - 1, floored at 0). */
    waitingYears: number | null;
    /** Which numbered eligibility year THIS fiscal year is — bare number from PromotionSummary.overdueYears, never calculated from today's date. */
    eligibilityYearNumber: number | null;
    /** Whole years at the CURRENT position level (Timeline-derived) — distinct from promotionCyclesPassed, never confused with it. */
    yearsInCurrentLevel: number | null;
    promotionCyclesPassed: number | null;
    /** Thai descriptions of unmet requirements (training/documents), when any. */
    blockers: string[];

    /** Buddhist-Era year the officer started their CURRENT rank ("เริ่มครองยศปัจจุบัน") — CommanderQueryOfficer.rankStartedAtYearBe, never recomputed. Null when no Timeline row's rank exactly matches the current rank. */
    currentRankStartedAtYearBe: number | null;
    /** Whole-year commander-facing YEAR COUNT at the current rank ("อายุในยศ") — CommanderQueryOfficer.yearsInRankCount. Null when currentRankStartedAtYearBe is unavailable — never a fabricated 0. */
    yearsInCurrentRank: number | null;

    /** Deterministic, non-AI confidence classification — see PromotionSummary.confidence's doc comment for the full meaning of each value. */
    confidence: "confirmed" | "derived" | "incomplete" | "unknown";
    /** Thai sentence explaining `confidence` when not "confirmed" — from PromotionSummary.confidenceReasonTh. Null when confidence is "confirmed". */
    confidenceReasonTh: string | null;
    /** Stable keys naming every piece of missing evidence — from PromotionSummary.missingEvidence. Empty when confidence is "confirmed". */
    missingEvidence: MissingEvidenceKey[];
  };

  retirement: {
    available: boolean;
    retirementYearBe: number | null;
    displayRetirementDateTh: string | null;
    displayRemainingTh: string | null;
    remainingDays: number | null;
    isRetired: boolean;
  };

  commander: {
    priorityLevel: "low" | "medium" | "high" | "critical" | null;
    actionRequired: boolean;
    /** Deterministic, non-AI-generated action items — see buildCommanderActions. */
    recommendations: CommanderActionItem[];
    flags: string[];
  };

  profileQuality: {
    available: boolean;
    completenessPercent: number | null;
    missingItems: string[];
    hasOfficialPortrait: boolean;
    hasGp7: boolean | null;
  };

  /** Phase 45 (Training Intelligence Engine) — the full TrainingSummary for this officer, evaluated against their next position level. See lib/intelligence/training/types.ts. */
  training: TrainingSummary;
}

export type CommanderActionSeverity = "urgent" | "recommended" | "informational";

export interface CommanderActionItem {
  textTh: string;
  severity: CommanderActionSeverity;
}
