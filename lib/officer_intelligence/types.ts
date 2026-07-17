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
    qualificationTextTh: string | null;
    /** Raw status enum — for badge-tone lookup only (PROMOTION_STATUS_TONE); never rendered directly as text. */
    status: PromotionEligibilityStatus;
    displayStatusTh: string | null;
    firstEligibleYearBe: number | null;
    firstEligibleDate: string | null;
    /** Whole promotion opportunities already missed since first becoming eligible — same "รอการแต่งตั้งมาแล้ว" semantics as Commander Search (overdueYears - 1, floored at 0). */
    waitingYears: number | null;
    /** Which numbered eligibility year THIS fiscal year is — bare number from PromotionSummary.overdueYears, never calculated from today's date. */
    eligibilityYearNumber: number | null;
    /** Whole years at the CURRENT position level (Timeline-derived) — distinct from promotionCyclesPassed, never confused with it. */
    yearsInCurrentLevel: number | null;
    promotionCyclesPassed: number | null;
    /** Thai descriptions of unmet requirements (training/documents), when any. */
    blockers: string[];
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
}

export type CommanderActionSeverity = "urgent" | "recommended" | "informational";

export interface CommanderActionItem {
  textTh: string;
  severity: CommanderActionSeverity;
}
