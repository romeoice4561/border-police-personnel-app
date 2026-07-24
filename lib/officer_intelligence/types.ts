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
    /**
     * Calendar Buddhist-Era year of first eligibility — from
     * PromotionSummary.firstEligibleYearBe (NOT firstEligibleFiscalYearBe).
     */
    firstEligibleYearBe: number | null;
    /** "พ.ศ. NNNN" — preformatted firstEligibleYearBe for Profile display. */
    displayFirstEligibleYearTh: string | null;
    /** ISO date of first eligibility — PromotionSummary.firstEligibleDate. */
    firstEligibleDate: string | null;
    /** PROMOTION_POLICIES.minYearsInPositionLevel for the target level — from PromotionSummary.requiredTenureYears, never recomputed. Null when no policy is configured. */
    requiredTenureYears: number | null;
    /** Engine tenure shortfall label (year-based) — PromotionSummary.waitingReasonTh. Prefer displayReasonTh for Profile. */
    waitingReasonTh: string | null;
    /** Phase 49.10: commander-facing reason — PromotionSummary.displayReasonTh. */
    displayReasonTh: string | null;
    /** Approx whole years remaining — PromotionSummary.remainingTenureYears. */
    remainingTenureYears: number | null;
    /** Profile "เหลืออีก" text — PromotionSummary.displayRemainingTenureTh. */
    displayRemainingTenureTh: string | null;
    /** Whole promotion opportunities already missed since first becoming eligible — same as PromotionSummary.overdueYears when > 0 (first eligible cycle = null, not 0). */
    waitingYears: number | null;
    /**
     * Presentation text for the "รอการแต่งตั้งมาแล้ว" field — "ครบคุณสมบัติในปีนี้"
     * when already eligible in the first cycle (waitingYears null), otherwise
     * "N ปี". Never computed in JSX.
     */
    displayWaitingTh: string | null;
    /** Which numbered eligibility year THIS fiscal year is — bare number from PromotionSummary.eligibleYearOrdinal (1 = first eligible cycle), never from overdueYears. */
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
